import { useSyncExternalStore, type ReactNode } from "react";
import { BookOpenCheck, ChevronDown } from "lucide-react";

const subscribeNoop = () => () => {};

function isPrivateOrLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "0.0.0.0"
  );
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        aria-hidden="true"
      >
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="mt-1 flex flex-col gap-1.5 text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{children}</code>;
}

export function KoreaderSetupGuide() {
  // The address the user typed in the browser is the best hint for the Server URL.
  const address = useSyncExternalStore(
    subscribeNoop,
    () => window.location.origin,
    () => "",
  );
  const hostname = useSyncExternalStore(
    subscribeNoop,
    () => window.location.hostname,
    () => "",
  );
  const looksLocal = hostname !== "" && isPrivateOrLocalHost(hostname);

  return (
    <details className="group rounded-lg border border-border bg-muted/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BookOpenCheck className="size-4" aria-hidden="true" />
          How to connect KOReader to Sake
        </span>
        <ChevronDown
          className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      <div className="flex flex-col gap-5 border-t border-border p-4">
        <p className="text-sm text-muted-foreground">
          Once connected, your reading progress, highlights and notes from KOReader are saved here
          automatically, and new books you add to Sake show up on your device. You only need to do
          this once per device.
        </p>

        <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Before you start</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              KOReader must be installed on your phone or e-reader (it is a separate free app, not
              part of Sake).
            </li>
            <li>
              Your phone must be able to reach this server: be on the <strong>same Wi-Fi</strong> as
              the computer running Sake, or use a private network such as Tailscale.
            </li>
          </ul>
        </div>

        <ol className="flex flex-col gap-4">
          <Step number={1} title="Download the plugin">
            <p>
              Use the <strong>Download</strong> button below on this page. You get a file named like{" "}
              <Code>sake-koplugin-v1.0.4.zip</Code>. If you downloaded it on a computer, send it to
              your phone (cable, cloud drive or email to yourself). Downloading it directly on the
              phone is easier.
            </p>
          </Step>

          <Step number={2} title="Unzip it into a folder called sake.koplugin">
            <p>
              Open your phone&apos;s file manager and extract the zip (tap it and choose
              &ldquo;Extract&rdquo;). The result must be a folder named exactly{" "}
              <Code>sake.koplugin</Code> containing files such as <Code>main.lua</Code> and{" "}
              <Code>_meta.lua</Code>.
            </p>
            <p>
              The zip has no outer folder, so if your extractor creates one with a different name,
              rename it to <Code>sake.koplugin</Code>. The name matters.
            </p>
          </Step>

          <Step number={3} title="Move the folder into KOReader's plugins folder">
            <p>
              In the file manager, find the <Code>koreader</Code> folder (usually in your phone&apos;s
              main storage), open <Code>plugins</Code> inside it, and put <Code>sake.koplugin</Code>{" "}
              there. The final path looks like:
            </p>
            <p>
              <Code>koreader/plugins/sake.koplugin/main.lua</Code>
            </p>
            <p>
              On Android 11 or newer some file managers cannot write into other apps&apos; folders. If
              that happens, use a file manager that can (for example &ldquo;Files by Google&rdquo; or
              &ldquo;Solid Explorer&rdquo;) and look for the <Code>koreader</Code> folder in internal
              storage.
            </p>
          </Step>

          <Step number={4} title="Restart KOReader">
            <p>
              Close KOReader completely (remove it from recent apps) and open it again. Plugins are
              only loaded at startup.
            </p>
          </Step>

          <Step number={5} title="Enter this server's address">
            <p>
              In KOReader open a book or the file browser, tap the top of the screen to show the
              menu, then go to the gear/tools icon → <strong>More tools</strong> →{" "}
              <strong>Sake</strong> → <strong>Setup</strong>. In <strong>Server URL</strong> type:
            </p>
            {address && (
              <p>
                <Code>{address}</Code>
              </p>
            )}
            {looksLocal ? (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-foreground">
                You are viewing Sake as <Code>{hostname}</Code>, which only works on this computer.
                On your phone, replace it with this computer&apos;s network address (for example{" "}
                <Code>http://192.168.1.50:{window.location.port || "5173"}</Code>). On Windows run{" "}
                <Code>ipconfig</Code> and look for &ldquo;IPv4 Address&rdquo;; on Mac or Linux use{" "}
                <Code>ip addr</Code> or System Settings → Network. Also make sure your firewall
                allows that port.
              </p>
            ) : (
              <p>Use exactly the address you use in your browser, including the port number if there is one.</p>
            )}
            <p>You can also give the device a name, like &ldquo;My phone&rdquo;.</p>
          </Step>

          <Step number={6} title="Pair the device">
            <p>
              Back in the Sake menu choose <strong>Pair Device</strong> and sign in with the same
              username and password you use on this website. The password is exchanged for a private
              key and is not stored on the phone.
            </p>
          </Step>

          <Step number={7} title="Read and sync">
            <p>
              Use <strong>Download New Books</strong> to get your library onto the device. Read as
              usual: progress is uploaded when you close the book or the screen turns off. To upload
              books already on the phone, choose <strong>Import or Export Existing Library</strong>{" "}
              (can take a while).
            </p>
            <p>
              Check it worked: after reading a bit, open <strong>Library</strong> in Sake and look
              for your progress on that book.
            </p>
          </Step>
        </ol>

        <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">If something does not work</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>No &ldquo;Sake&rdquo; in the menu:</strong> the folder is in the wrong place or
              named wrongly (step 2 and 3), or KOReader was not fully restarted.
            </li>
            <li>
              <strong>Cannot connect:</strong> the phone is on a different network, the address is
              wrong, or the computer running Sake is off or asleep.
            </li>
            <li>
              <strong>Login fails:</strong> use your Sake web username and password, not your
              KOReader or Google account.
            </li>
            <li>
              <strong>Want to see what the device is doing:</strong> in KOReader enable{" "}
              <strong>Maintenance → Remote Log Shipping</strong>, then check <strong>Logs →
              Devices</strong> in Sake.
            </li>
          </ul>
        </div>
      </div>
    </details>
  );
}
