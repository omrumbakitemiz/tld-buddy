using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MelonLoader;

namespace TldBuddy.Mod
{
    /// <summary>
    /// Posts the live state to the TLD Buddy server (POST /api/live/v1/state) off the game thread.
    /// At most one request is in flight; while one is pending, newer updates are skipped rather
    /// than queued, so a slow or unreachable server never piles up work or stalls the game.
    /// </summary>
    sealed class LiveBridge
    {
        static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(3);
        static readonly TimeSpan FailureLogInterval = TimeSpan.FromMinutes(1);

        readonly HttpClient http = new HttpClient { Timeout = RequestTimeout };
        readonly MelonLogger.Instance log;
        // Only touched by the single in-flight request, so no locking needed
        int inFlight;
        bool connected;
        bool failing;
        DateTime lastFailureLog;

        public LiveBridge(MelonLogger.Instance log)
        {
            this.log = log;
        }

        public void Send(string serverUrl, string token, string json)
        {
            if (Interlocked.CompareExchange(ref inFlight, 1, 0) != 0) return;
            string url = serverUrl.TrimEnd('/') + "/api/live/v1/state";
            // Not awaited: runs on the thread pool once the first await yields
            _ = PostAsync(url, token, json);
        }

        async Task PostAsync(string url, string token, string json)
        {
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");
                using var response = await http.SendAsync(request).ConfigureAwait(false);
                if (response.IsSuccessStatusCode) Recovered(url);
                else Failed(url, $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}");
            }
            catch (Exception e)
            {
                Failed(url, e.GetBaseException().Message);
            }
            finally
            {
                Interlocked.Exchange(ref inFlight, 0);
            }
        }

        /// <summary>Logs the first failure, then at most once a minute while it keeps failing.</summary>
        void Failed(string url, string reason)
        {
            DateTime now = DateTime.UtcNow;
            if (failing && now - lastFailureLog < FailureLogInterval) return;
            failing = true;
            lastFailureLog = now;
            log.Warning($"Live bridge: cannot reach {url}: {reason}");
        }

        /// <summary>Logs the first success and the first success after failures.</summary>
        void Recovered(string url)
        {
            if (connected && !failing) return;
            log.Msg(failing ? $"Live bridge: connected to {url} again" : $"Live bridge: connected to {url}");
            connected = true;
            failing = false;
        }
    }
}
