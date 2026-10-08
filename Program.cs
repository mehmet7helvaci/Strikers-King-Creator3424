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

            Process serverProc = null;
            if (activePort == 0)
            {
                serverProc = StartServerProcess();

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

            string targetUrl = isOverlayReq 
                ? string.Format("http://localhost:{0}/?overlay=1", activePort)
                : string.Format("http://localhost:{0}", activePort);

            // 2. Start Application in System Tray context with NotifyIcon & background match listener
            Application.Run(new TrayApplicationContext(activePort, targetUrl, serverProc));
        }

        public static Process StartServerProcess(int port = 18888)
        {
            string serverScript = Path.Combine(scriptDir, "server.ps1");
            ProcessStartInfo psInfo = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = string.Format("-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File \"{0}\" -NoLaunch -Port {1}", serverScript, port),
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = scriptDir
            };

            try
            {
                return Process.Start(psInfo);
            }
            catch
            {
                return null;
            }
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

        private static Thread hotkeyThread = null;
        private static volatile bool isHotkeyRunning = false;
        private static NotifyIcon globalTrayIcon = null;

        public static void StartMatchCaptureHotkeyThread(int port, NotifyIcon trayIcon)
        {
            if (isHotkeyRunning) return;
            isHotkeyRunning = true;
            globalTrayIcon = trayIcon;

            hotkeyThread = new Thread(new ParameterizedThreadStart(HotkeyWorkerLoop));
            hotkeyThread.IsBackground = true;
            hotkeyThread.SetApartmentState(ApartmentState.STA);
            hotkeyThread.Start(port);
        }

        public static void StopMatchCaptureHotkeyThread()
        {
            isHotkeyRunning = false;
        }

        private static void HotkeyWorkerLoop(object stateObj)
        {
            int port = (int)stateObj;
            DateTime lastCaptureTime = DateTime.MinValue;

            while (isHotkeyRunning)
            {
                try
                {
                    // F9 tuşunu dinle (0x78 = VK_F9)
                    short f9State = GetAsyncKeyState(0x78);
                    bool isF9Down = (f9State & 0x8000) != 0;

                    if (isF9Down)
                    {
                        DateTime now = DateTime.UtcNow;
                        if ((now - lastCaptureTime).TotalMilliseconds >= 1500)
                        {
                            lastCaptureTime = now;
                            CaptureScreenForActiveMatch(port, globalTrayIcon);
                        }
                    }
                }
                catch { }

                Thread.Sleep(100);
            }
        }

        public static void CaptureScreenForActiveMatch(int port, NotifyIcon trayIcon = null)
        {
            try
            {
                string matchId = "single_match";
                try
                {
                    string stateUrl = string.Format("http://localhost:{0}/api/watcher/state", port);
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create(stateUrl);
                    req.Timeout = 800;
                    using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                    using (StreamReader sr = new StreamReader(resp.GetResponseStream(), Encoding.UTF8))
                    {
                        string body = sr.ReadToEnd();
                        int mIdx = body.IndexOf("\"activeMatch\":");
                        if (mIdx >= 0)
                        {
                            int valStart = body.IndexOf('\"', mIdx + 14);
                            if (valStart >= 0)
                            {
                                int valEnd = body.IndexOf('\"', valStart + 1);
                                if (valEnd > valStart)
                                {
                                    string extracted = body.Substring(valStart + 1, valEnd - valStart - 1).Trim();
                                    if (!string.IsNullOrEmpty(extracted))
                                    {
                                        matchId = Regex.Replace(extracted, @"[^a-zA-Z0-9_-]", "");
                                    }
                                }
                            }
                        }
                    }
                }
                catch { }

                if (string.IsNullOrEmpty(matchId)) matchId = "single_match";

                string capturesDir = Path.Combine(scriptDir, "data", "match_captures");
                if (!Directory.Exists(capturesDir))
                {
                    Directory.CreateDirectory(capturesDir);
                }

                long ts = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds;
                string fileName = string.Format("capture_{0}_{1}.jpg", matchId, ts);
                string imgPath = Path.Combine(capturesDir, fileName);

                Rectangle bounds = Screen.PrimaryScreen.Bounds;
                using (Bitmap bmp = new Bitmap(bounds.Width, bounds.Height, PixelFormat.Format32bppArgb))
                {
                    using (Graphics g = Graphics.FromImage(bmp))
                    {
                        g.CopyFromScreen(bounds.X, bounds.Y, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
                    }
                    bmp.Save(imgPath, ImageFormat.Jpeg);
                }

                // Also save last_tab_capture.jpg for backward compatibility
                try
                {
                    string lastPath = Path.Combine(scriptDir, "data", "last_tab_capture.jpg");
                    File.Copy(imgPath, lastPath, true);
                }
                catch { }

                // Post event to local server
                try
                {
                    string reportUrl = string.Format("http://localhost:{0}/api/match/capture", port);
                    HttpWebRequest postReq = (HttpWebRequest)WebRequest.Create(reportUrl);
                    postReq.Method = "POST";
                    postReq.ContentType = "application/json; charset=utf-8";
                    postReq.Timeout = 1500;
                    string payload = string.Format("{{\"matchId\":\"{0}\",\"filename\":\"{1}\"}}", matchId, fileName);
                    byte[] bytes = Encoding.UTF8.GetBytes(payload);
                    postReq.ContentLength = bytes.Length;
                    using (Stream os = postReq.GetRequestStream())
                    {
                        os.Write(bytes, 0, bytes.Length);
                    }
                    using (HttpWebResponse presp = (HttpWebResponse)postReq.GetResponse()) { }
                }
                catch { }

                if (trayIcon != null)
                {
                    trayIcon.ShowBalloonTip(
                        2500,
                        "📸 Maç Skor Ekranı Yakalandı!",
                        string.Format("Görüntü kaydedildi ({0}). Golleri işlemek için maçın 📁 simgesine tıklayın.", fileName),
                        ToolTipIcon.Info
                    );
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
        private Process serverProcess;
        private Thread serverWatchdogThread;
        private volatile bool isWatchdogRunning = false;
        private Process currentBrowserProc;
        private Thread hubNotificationThread;
        private volatile bool isNotificationRunning = false;
        private bool hasShownTrayBalloon = false;

        public TrayApplicationContext(int port, string url, Process serverProc = null)
        {
            this.activePort = port;
            this.targetUrl = url;
            this.serverProcess = serverProc;

            InitializeTray();
            StartHubNotificationListener();
            StartServerWatchdog();
            LaunchBrowser();
        }

        private void InitializeTray()
        {
            contextMenu = new ContextMenuStrip();

            ToolStripMenuItem openItem = new ToolStripMenuItem("🎮 Uygulamayı Aç (Arayüz)");
            openItem.Click += delegate { LaunchBrowser(); };
            openItem.Font = new Font(openItem.Font, FontStyle.Bold);

            ToolStripMenuItem captureItem = new ToolStripMenuItem("📸 Canlı Maç Ekranını Kaydet (F9)");
            captureItem.Click += delegate { Program.CaptureScreenForActiveMatch(activePort, notifyIcon); };

            ToolStripMenuItem browserItem = new ToolStripMenuItem("🌐 Varsayılan Tarayıcıda Aç");
            browserItem.Click += delegate { try { Process.Start(targetUrl); } catch { } };

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
            contextMenu.Items.Add(captureItem);
            contextMenu.Items.Add(browserItem);
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

            // Start background F9 match capture hotkey listener
            Program.StartMatchCaptureHotkeyThread(activePort, notifyIcon);
        }

        private void StartServerWatchdog()
        {
            if (isWatchdogRunning) return;
            isWatchdogRunning = true;

            serverWatchdogThread = new Thread(new ThreadStart(ServerWatchdogLoop));
            serverWatchdogThread.IsBackground = true;
            serverWatchdogThread.Start();
        }

        private void ServerWatchdogLoop()
        {
            int consecutiveFailures = 0;
            while (isWatchdogRunning)
            {
                try
                {
                    Thread.Sleep(3000);
                    if (!isWatchdogRunning) break;

                    // 1. If server process crashed/exited, immediately restart it on the same designated port
                    if (serverProcess != null && serverProcess.HasExited)
                    {
                        serverProcess = Program.StartServerProcess(activePort);
                        consecutiveFailures = 0;
                        Thread.Sleep(2000);
                        continue;
                    }

                    // 2. Health check with safe 5000ms timeout
                    bool isAlive = false;
                    try
                    {
                        string statusUrl = string.Format("http://localhost:{0}/api/status", activePort);
                        HttpWebRequest req = (HttpWebRequest)WebRequest.Create(statusUrl);
                        req.Timeout = 5000;
                        using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                        {
                            if (resp.StatusCode == HttpStatusCode.OK)
                            {
                                isAlive = true;
                            }
                        }
                    }
                    catch { isAlive = false; }

                    if (isAlive)
                    {
                        consecutiveFailures = 0;
                    }
                    else
                    {
                        consecutiveFailures++;
                        // Only intervene if server is unresponsive for 6 consecutive checks (~18-20 seconds)
                        if (consecutiveFailures >= 6)
                        {
                            consecutiveFailures = 0;
                            if (serverProcess != null)
                            {
                                try { if (!serverProcess.HasExited) serverProcess.Kill(); } catch { }
                            }
                            serverProcess = Program.StartServerProcess(activePort);
                        }
                    }
                }
                catch { }
            }
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

                // Native Desktop Application & Isolated Chromium flags:
                // Prevents AMD Radeon RX 7000 / RDNA3 MPO & DWM black screen crash and suppresses browser UI
                string browserArgs = string.Format(
                    "--app=\"{0}\" --user-data-dir=\"{1}\" --name=\"Strickers King Creator\" " +
                    "--window-size=1380,860 --start-maximized " +
                    "--autoplay-policy=no-user-gesture-required --disable-http-cache " +
                    "--disable-extensions --disable-background-networking --disable-component-update " +
                    "--disable-backgrounding-occluded-windows --disable-renderer-backgrounding --disable-background-timer-throttling " +
                    "--disable-blink-features=AutomationControlled --disable-default-apps --disable-sync --suppress-message-center " +
                    "--disable-features=CalculateNativeWinOcclusion,DCompPresenter,Translate,OptimizationHints,MediaRouter --disable-gpu-watchdog " +
                    "--no-first-run --no-default-browser-check",
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
            isWatchdogRunning = false;
            isNotificationRunning = false;
            Program.StopMatchCaptureHotkeyThread();

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

            if (serverProcess != null && !serverProcess.HasExited)
            {
                try { serverProcess.Kill(); } catch { }
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
