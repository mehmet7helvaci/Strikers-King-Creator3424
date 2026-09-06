using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace StrickersClubCreator
{
    static class Program
    {
        [DllImport("shell32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
        private static extern int SetCurrentProcessExplicitAppUserModelID(string AppID);

        [STAThread]
        static void Main()
        {
            try
            {
                // Set Windows Taskbar AppUserModelID so taskbar displays app icon properly
                SetCurrentProcessExplicitAppUserModelID("StrickersKing.Creator.App.v1");
            }
            catch { }

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string scriptDir = AppDomain.CurrentDomain.BaseDirectory;
            string serverScript = Path.Combine(scriptDir, "server.ps1");

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

            string targetUrl = string.Format("http://localhost:{0}", activePort);

            // 2. Locate MS Edge or Chrome browser executable for standalone --app mode
            string browserPath = FindBrowserExecutable();

            if (!string.IsNullOrEmpty(browserPath))
            {
                string appDataDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "StrickersKingCreatorProfile"
                );

                string args = string.Format(
                    "--app=\"{0}\" --user-data-dir=\"{1}\" --name=\"Strickers King Creator\" --autoplay-policy=no-user-gesture-required --disable-http-cache",
                    targetUrl,
                    appDataDir
                );

                ProcessStartInfo browserInfo = new ProcessStartInfo
                {
                    FileName = browserPath,
                    Arguments = args,
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
    }
}
