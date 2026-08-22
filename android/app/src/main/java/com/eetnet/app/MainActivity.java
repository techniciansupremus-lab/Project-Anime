package com.eetnet.app;

import com.getcapacitor.BridgeActivity;

import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.util.HashSet;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class MainActivity extends BridgeActivity {

  // Substring/ad-server patterns blocked at the network layer inside the app's
  // own WebView. Blocks in-frame ad requests (popups are already killed by the
  // iframe sandbox in the frontend). Keep this tight: blocking a host the player
  // actually streams video from would break playback.
  private static final String[] AD_PATTERNS = new String[]{
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "adservice.google.com",
    "pagead2.googlesyndication.com",
    "google-analytics.com",
    "googletagmanager.com",
    "tiktokcdn.com",
    "pstatp.com",
    "byteoversea.com",
    "ad-site-sign",
    "popads.net",
    "popcash.net",
    "propellerads.com",
    "outbrain.com",
    "taboola.com",
    "scorecardresearch.com",
    "criteo.com",
    "rubiconproject.com",
    "pubmatic.com",
    "adnxs.com",
    "adsystem",
    "2mdn.net",
    "moatads.com",
    "adsrvr.org",
    "adform.net",
    "mgid.com",
    "revcontent.com",
    "adf.ly",
    "exe.io",
    "shrinkme",
    "shortly.gg",
    "linkvertise",
    "ouo.io",
    "bc.vc"
  };

  private final Set<String> adSet = new HashSet<>();

  @Override
  public void onResume() {
    super.onResume();
    if (adSet.isEmpty()) {
      for (String p : AD_PATTERNS) adSet.add(p);
    }
    WebView wv = getBridge().getWebView();
    if (wv != null) {
      wv.setWebViewClient(new AdBlockingWebViewClient());
    }
  }

  private boolean isAd(String url) {
    if (url == null) return false;
    String lower = url.toLowerCase();
    for (String p : adSet) {
      if (lower.contains(p)) return true;
    }
    return false;
  }

  private class AdBlockingWebViewClient extends WebViewClient {
    // Block third-party ad/popup requests before they leave the device.
    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
      String url = request.getUrl() != null ? request.getUrl().toString() : null;
      if (isAd(url)) {
        // Return an empty 200 so the embed's JS doesn't error/retry hard; the
        // ad slot simply stays blank.
        return new WebResourceResponse("text/plain", "utf-8",
            new ByteArrayInputStream("".getBytes()));
      }
      return super.shouldInterceptRequest(view, request);
    }

    // Stop "click → full-page ad redirect" (top-navigation hijack).
    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
      String url = request.getUrl() != null ? request.getUrl().toString() : null;
      if (isAd(url)) {
        return true; // swallow it
      }
      return super.shouldOverrideUrlLoading(view, request);
    }
  }
}
