type ViewerWindow = Window & {
  viewerOriginalURI?: string;
};

type OpenInViewer = (
  uri: string,
  options?: { allowJavaScript?: boolean },
) => ViewerWindow;

export class SessionManager {
  private autoWindow?: ViewerWindow;
  private autoURL?: string;
  private accountWindow?: ViewerWindow;
  private accountURL?: string;

  private open(url: string, accountMode: boolean): ViewerWindow {
    const current = accountMode ? this.accountWindow : this.autoWindow;
    const currentURL = accountMode ? this.accountURL : this.autoURL;
    if (current && !current.closed && currentURL === url) {
      current.focus();
      return current;
    }
    if (current && !current.closed) current.close();

    const openInViewer = Zotero.openInViewer as unknown as OpenInViewer;
    const viewer = openInViewer(url, { allowJavaScript: true });
    if (!viewer) throw new Error("Zotero 未能创建 hjfy.top 登录窗口");
    if (accountMode) {
      this.accountWindow = viewer;
      this.accountURL = url;
    } else {
      this.autoWindow = viewer;
      this.autoURL = url;
    }
    return viewer;
  }

  openForTask(url: string): void {
    this.open(url, false);
  }

  openAccount(url: string): ViewerWindow {
    return this.open(url, true);
  }

  closeTaskLogin(): void {
    if (this.autoWindow && !this.autoWindow.closed) this.autoWindow.close();
    this.autoWindow = undefined;
    this.autoURL = undefined;
  }

  clearSession(host = "hjfy.top"): void {
    for (const cookie of Services.cookies.cookies) {
      const cookieHost = cookie.host.replace(/^\./, "");
      if (cookieHost === host || cookieHost.endsWith(`.${host}`)) {
        Services.cookies.remove(
          cookie.host,
          cookie.name,
          cookie.path,
          cookie.originAttributes,
        );
      }
    }
  }

  closeAll(): void {
    this.closeTaskLogin();
    if (this.accountWindow && !this.accountWindow.closed) {
      this.accountWindow.close();
    }
    this.accountWindow = undefined;
    this.accountURL = undefined;
  }
}
