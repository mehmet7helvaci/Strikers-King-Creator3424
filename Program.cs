using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
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

        private static string scriptDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "app");

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

            // 2. Locate MS Edge or Chrome browser executable for standalone --app mode
            string browserPath = FindBrowserExecutable();

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

                Process browserProc = Process.Start(browserInfo);
                if (browserProc != null)
                {
                    // Keep application running while window is open
                    browserProc.WaitForExit();
                }
            }
            else
            {
                // Fallback if no chromium browser is found
                Process.Start(targetUrl);
            }

            StopScoreboardWatcherThread();
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

        private static string FindBrowserExecutable()
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

        private static void StopScoreboardWatcherThread()
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
}
