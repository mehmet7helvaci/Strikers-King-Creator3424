using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

namespace StrickersClubCreator
{
    static class Program
    {
        [DllImport("shell32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern int SetCurrentProcessExplicitAppUserModelID(string AppID);

        [DllImport("user32.dll")]
        private static extern short GetAsyncKeyState(int vKey);

        static Mutex mutex = new Mutex(true, "{8F9A4C62-B9E1-438B-93D2-6C81B4B6E7E9}");

        public static string scriptDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");

        [STAThread]
        static void Main(string[] args)
        {
            if (!mutex.WaitOne(TimeSpan.Zero, true))
            {
                MessageBox.Show("Uygulama zaten çalışıyor!", "Hata", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            try
            {
                // Set Windows Taskbar AppUserModelID so taskbar displays app icon properly
                SetCurrentProcessExplicitAppUserModelID("StrickersKing.Creator.App.v1");
            }
            catch { }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string serverScript = Path.Combine(scriptDir, "server.ps1");

            // Check if overlay mode was explicitly requested via arguments
            bool isOverlayReq = false;
            if (args != null && args.Length > 0)
            {
                foreach (string a in args)
                {
                    if (string.Equals(a, "--overlay", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a, "-overlay", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a, "overlay", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a, "--obs", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a, "-obs", StringComparison.OrdinalIgnoreCase) ||
                        string.Equals(a, "obs", StringComparison.OrdinalIgnoreCase))
                    {
                        isOverlayReq = true;
                        break;
                    }
                }
            }

            // 1. Detect if HTTP server is already running on any port in range 18888-18895
            int activePort = FindActiveServerPort();

            if (activePort == 0)
            {
                // Start PowerShell HTTP server silently in background without console window
                ProcessStartInfo psInfo = new ProcessStartInfo
                {
                    FileName = "powershell.exe",
                    Arguments = string.Format("-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"{0}\" -NoLaunch", serverScript),
                    UseShellExecute = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    WorkingDirectory = scriptDir
                };

                try
                {
                    Process.Start(psInfo);
                }
                catch { }

                // Wait up to 6 seconds for server to start and detect active port
                for (int i = 0; i < 24; i++)
                {
                    Thread.Sleep(250);
                    activePort = FindActiveServerPort();
                    if (activePort > 0)
                        break;
                }
            }

            // Fallback to default port if not detected
            if (activePort == 0)
                activePort = 18888;

            // Start silent native background screen & TAB scoreboard watcher
            StartScoreboardWatcherThread(activePort);

            string targetUrl = isOverlayReq 
                ? string.Format("http://localhost:{0}/?overlay=1", activePort)
                : string.Format("http://localhost:{0}", activePort);

            // 2. Start Application in System Tray context with NotifyIcon & background match listener
            Application.Run(new TrayApplicationContext(activePort, targetUrl));
        }

        private static int FindActiveServerPort()
        {
            for (int p = 18888; p <= 18895; p++)
            {
                try
                {
                    string statusUrl = string.Format("http://localhost:{0}/api/status", p);
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(statusUrl);
                    req.Timeout = 500;
                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    {
                        if (resp.StatusCode == HttpStatusCode.OK)
                            return p;
                    }
                }
                catch { }
            }

            return 0;
        }

        public static string FindBrowserExecutable()
        {
            string[] possiblePaths = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
            };

            foreach (string p in possiblePaths)
            {
                if (File.Exists(p))
                    return p;
            }

            return null;
        }

        private static Thread watcherThread = null;
        private static volatile bool isWatcherRunning = false;

        private static void StartScoreboardWatcherThread(int port)
        {
            if (isWatcherRunning) return;
            isWatcherRunning = true;

            watcherThread = new Thread(new ParameterizedThreadStart(WatcherWorkerLoop));
            watcherThread.IsBackground = true;
            watcherThread.SetApartmentState(ApartmentState.STA);
            watcherThread.Start(port);
        }

        public static void StopScoreboardWatcherThread()
        {
            isWatcherRunning = false;
        }

        private static void WatcherWorkerLoop(object stateObj)
        {
            int port = (int)stateObj;
            bool watcherEnabled = false;
            DateTime lastCheckState = DateTime.MinValue;
            DateTime lastScoreReported = DateTime.MinValue;
            bool wasTabPressed = false;
            DateTime tabPressedTime = DateTime.MinValue;

            while (isWatcherRunning)
            {
                try
                {
                    DateTime now = DateTime.UtcNow;

                    // Poll enabled state every 2 seconds
                    if ((now - lastCheckState).TotalSeconds >= 2.0)
                    {
                        lastCheckState = now;
                        try
                        {
                            string stateUrl = string.Format("http://localhost:{0}/api/watcher/state", port);
                            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(stateUrl);
                            req.Timeout = 800;
                            using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                            using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                            {
                                string body = sr.ReadToEnd();
                                watcherEnabled = body.IndexOf("\"enabled\":true", StringComparison.OrdinalIgnoreCase) >= 0;
                            }
                        }
                        catch { }
                    }

                    if (watcherEnabled)
                    {
                        // Check TAB key (0x09 = VK_TAB)
                        short tabState = GetAsyncKeyState(0x09);
                        bool isTabDown = (tabState & 0x8000) != 0;

                        if (isTabDown)
                        {
                            if (!wasTabPressed)
                            {
                                wasTabPressed = true;
                                tabPressedTime = now;
                            }
                        }
                        else if (wasTabPressed)
                        {
                            // TAB released after being held
                            wasTabPressed = false;
                            double heldMs = (now - tabPressedTime).TotalMilliseconds;
                            if (heldMs >= 200 && (now - lastScoreReported).TotalSeconds >= 2.0)
                            {
                                lastScoreReported = now;
                                CaptureAndAnalyzeScreen(port);
                            }
                        }
                    }
                }
                catch { }

                Thread.Sleep(80);
            }
        }

        private static void CaptureAndAnalyzeScreen(int port)
        {
            try
            {
                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                using (Bitmap bmp = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.CopyFromScreen(bounds.X, bounds.Y, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
                    }

                    // Save captured TAB frame for live review & instant confirmation in UI
                    try
                    {
                        string dataDir = Path.Combine(scriptDir, "data");
                        if (!Directory.Exists(dataDir))
                        {
                            Directory.CreateDirectory(dataDir);
                        }
                        string imgPath = Path.Combine(dataDir, "last_tab_capture.jpg");
                        bmp.Save(imgPath, ImageFormat.Jpeg);
                    }
                    catch { }

                    // Send detected TAB scoreboard event to server
                    string reportUrl = string.Format("http://localhost:{0}/api/watcher/score", port);
                    HttpWebRequest postReq = (HttpWebRequest)WebRequest.Create(reportUrl);
                    postReq.Method = "POST";
                    postReq.ContentType = "application/json; charset=utf-8";
                    postReq.Timeout = 1500;
                    string payload = "{\"player\":\"TAB Skor Tablosu\",\"type\":\"tab_capture\",\"image\":\"data/last_tab_capture.jpg\",\"count\":1}";
                    byte[] bytes = Encoding.UTF8.GetBytes(payload);
                    postReq.ContentLength = bytes.Length;
                    using (Stream os = postReq.GetRequestStream())
                    {
                        os.Write(bytes, 0, bytes.Length);
                    }
                    using (HttpWebResponse presp = (HttpWebResponse)postReq.GetResponse()) { }
                }
            }
            catch { }
        }
    }

    class TrayApplicationContext : ApplicationContext
    {
        private NotifyIcon notifyIcon;
        private ContextMenuStrip contextMenu;
        private int activePort;
        private string targetUrl;
        private Process currentBrowserProc;
        private Thread hubNotificationThread;
        private volatile bool isNotificationRunning = false;
        private bool hasShownTrayBalloon = false;

        public TrayApplicationContext(int port, string url)
        {
            this.activePort = port;
            this.targetUrl = url;

            InitializeTray();
            StartHubNotificationListener();
            LaunchBrowser();
        }

        private void InitializeTray()
        {
            contextMenu = new ContextMenuStrip();

            ToolStripMenuItem openItem = new ToolStripMenuItem("🎮 Uygulamayı Aç (Arayüz)");
            openItem.Click += delegate { LaunchBrowser(); };
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);

            ToolStripMenuItem obsItem = new ToolStripMenuItem("📺 OBS Canlı Overlay Aç");
            obsItem.Click += delegate
            {
                string obsUrl = string.Format("http://localhost:{0}/?overlay=1", activePort);
                try { Process.Start(obsUrl); } catch { }
            };

            ToolStripSeparator sep = new ToolStripSeparator();

            ToolStripMenuItem exitItem = new ToolStripMenuItem("❌ Tamamen Çıkış Yap");
            exitItem.Click += delegate { ExitApplication(); };

            contextMenu.Items.Add(openItem);
            contextMenu.Items.Add(obsItem);
            contextMenu.Items.Add(sep);
            contextMenu.Items.Add(exitItem);

            notifyIcon = new NotifyIcon();
            notifyIcon.Text = "Strickers King Creator (Espor Ligi)";

            string iconPath = Path.Combine(Program.scriptDir, "app.ico");
            if (File.Exists(iconPath))
            {
                try { notifyIcon.Icon = new Icon(iconPath); }
                catch { notifyIcon.Icon = SystemIcons.Application; }
            }
            else
            {
                notifyIcon.Icon = SystemIcons.Application;
            }

            notifyIcon.ContextMenuStrip = contextMenu;
            notifyIcon.Visible = true;

            notifyIcon.DoubleClick += delegate { LaunchBrowser(); };
            notifyIcon.BalloonTipClicked += delegate { LaunchBrowser(); };
        }

        public void LaunchBrowser()
        {
            if (currentBrowserProc != null && !currentBrowserProc.HasExited)
            {
                return;
            }

            string browserPath = Program.FindBrowserExecutable();
            if (!string.IsNullOrEmpty(browserPath))
            {
                string appDataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "StrickersKingCreatorProfile"
                );

                string browserArgs = string.Format(
                    "--app=\"{0}\" --user-data-dir=\"{1}\" --name=\"Strickers King Creator\" --autoplay-policy=no-user-gesture-required --disable-http-cache",
                    targetUrl,
                    appDataDir
                );

                ProcessStartInfo browserInfo = new ProcessStartInfo
                {
                    FileName = browserPath,
                    Arguments = browserArgs,
                    UseShellExecute = true
                };

                try
                {
                    currentBrowserProc = Process.Start(browserInfo);
                    if (currentBrowserProc != null)
                    {
                        Thread waitThread = new Thread(new ThreadStart(delegate
                        {
                            try
                            {
                                currentBrowserProc.WaitForExit();
                                if (!hasShownTrayBalloon && notifyIcon != null && notifyIcon.Visible)
                                {
                                    hasShownTrayBalloon = true;
                                    notifyIcon.ShowBalloonTip(
                                        3500,
                                        "Strickers King Creator",
                                        "Uygulama arka planda (saatin yanında) çalışmaya devam ediyor. Canlı maç sonuçları otomatik bildirilecektir.",
                                        ToolTipIcon.Info
                                    );
                                }
                            }
                            catch { }
                        }));
                        waitThread.IsBackground = true;
                        waitThread.Start();
                    }
                }
                catch
                {
                    try { Process.Start(targetUrl); } catch { }
                }
            }
            else
            {
                try { Process.Start(targetUrl); } catch { }
            }
        }

        private void StartHubNotificationListener()
        {
            if (isNotificationRunning) return;
            isNotificationRunning = true;

            hubNotificationThread = new Thread(new ThreadStart(NotificationWorkerLoop));
            hubNotificationThread.IsBackground = true;
            hubNotificationThread.Start();
        }

        private void NotificationWorkerLoop()
        {
            int lastEventId = 0;
            try
            {
                string syncInitUrl = string.Format("http://localhost:{0}/api/hub/sync?since=0&client=csharp_tray", activePort);
                HttpWebRequest initReq = (HttpWebRequest)WebRequest.Create(syncInitUrl);
                initReq.Timeout = 1200;
                using (HttpWebResponse resp = (HttpWebResponse)initReq.GetResponse())
                using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                {
                    string txt = sr.ReadToEnd();
                    int idx = txt.IndexOf("\"lastId\":");
                    if (idx >= 0)
                    {
                        string sub = txt.Substring(idx + 9);
                        int commaIdx = sub.IndexOfAny(new char[] { ',', '}', ']' });
                        if (commaIdx > 0)
                        {
                            int parsed;
                            if (int.TryParse(sub.Substring(0, commaIdx).Trim(), out parsed))
                            {
                                lastEventId = parsed;
                            }
                        }
                    }
                }
            }
            catch { }

            while (isNotificationRunning)
            {
                try
                {
                    string syncUrl = string.Format("http://localhost:{0}/api/hub/sync?since={1}&client=csharp_tray", activePort, lastEventId);
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(syncUrl);
                    req.Timeout = 1500;
                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    {
                        string body = sr.ReadToEnd();

                        int lastIdIdx = body.IndexOf("\"lastId\":");
                        if (lastIdIdx >= 0)
                        {
                            string sub = body.Substring(lastIdIdx + 9);
                            int commaIdx = sub.IndexOfAny(new char[] { ',', '}', ']' });
                            if (commaIdx > 0)
                            {
                                int parsed;
                                if (int.TryParse(sub.Substring(0, commaIdx).Trim(), out parsed) && parsed > lastEventId)
                                {
                                    lastEventId = parsed;
                                }
                            }
                        }

                        int searchIdx = 0;
                        while ((searchIdx = body.IndexOf("\"type\":\"MATCH_RECORDED\"", searchIdx, StringComparison.OrdinalIgnoreCase)) >= 0)
                        {
                            string summary = "Canlı Espor Ligi maçı kaydedildi!";
                            int sumIdx = body.IndexOf("\"summary\":", searchIdx);
                            if (sumIdx >= 0)
                            {
                                int valStart = body.IndexOf('\"', sumIdx + 10);
                                if (valStart >= 0)
                                {
                                    int valEnd = body.IndexOf('\"', valStart + 1);
                                    if (valEnd > valStart)
                                    {
                                        summary = DecodeJsonString(body.Substring(valStart + 1, valEnd - valStart - 1));
                                    }
                                }
                            }

                            if (notifyIcon != null)
                            {
                                notifyIcon.ShowBalloonTip(
                                    5000,
                                    "🏆 Maç Sonucu Kaydedildi!",
                                    summary,
                                    ToolTipIcon.Info
                                );
                            }

                            searchIdx += 23;
                        }
                    }
                }
                catch { }

                Thread.Sleep(1500);
            }
        }

        private static string DecodeJsonString(string text)
        {
            if (string.IsNullOrEmpty(text)) return string.Empty;
            try
            {
                text = Regex.Replace(text, @"\\u(?<val>[a-fA-F0-9]{4})", delegate(Match m)
                {
                    return ((char)Convert.ToInt32(m.Groups["val"].Value, 16)).ToString();
                });
            }
            catch { }
            return text.Replace("\\\"", "\"").Replace("\\\\", "\\").Replace("\\/", "/");
        }

        private void ExitApplication()
        {
            isNotificationRunning = false;
            Program.StopScoreboardWatcherThread();

            if (notifyIcon != null)
            {
                notifyIcon.Visible = false;
                notifyIcon.Dispose();
                notifyIcon = null;
            }

            if (contextMenu != null)
            {
                contextMenu.Dispose();
                contextMenu = null;
            }

            if (currentBrowserProc != null && !currentBrowserProc.HasExited)
            {
                try { currentBrowserProc.Kill(); } catch { }
            }

            ExitThread();
            Application.Exit();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                ExitApplication();
            }
            base.Dispose(disposing);
        }
    }
}
