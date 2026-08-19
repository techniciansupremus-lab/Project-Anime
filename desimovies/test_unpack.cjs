const axios = require('axios');
const vm = require('node:vm');

async function testMorencius() {
  const embedUrl = 'https://morencius.com/embed/to6qdqkjkpaa';
  console.log('[TEST] Fetching Morencius embed:', embedUrl);
  
  try {
    const res = await axios.get(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://desicinemas.pk/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 10000
    });

    const html = res.data;
    console.log('[TEST] Embed HTML length:', html.length);

    // Look for eval(function(p,a,c,k,e,d)...)
    const evalMatch = html.match(/eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\.split\('\|'\)\)\s*\)/i);
    
    if (!evalMatch) {
      console.log('[TEST] No eval packed JS found!');
      return;
    }

    console.log('[TEST] Found packed JS (length ' + evalMatch[0].length + ')');

    let capturedSources = [];
    let capturedConfig = null;

    const mockElement = () => ({
      style: {},
      setAttribute: () => {},
      getAttribute: () => '',
      appendChild: () => {},
      removeChild: () => {},
      parentNode: { removeChild: () => {} },
      classList: { add: () => {}, remove: () => {} }
    });

    const mock$ = () => ({
      insertAfter: () => {},
      detach: () => {},
      remove: () => {},
      hide: () => {},
      show: () => {},
      on: () => {},
      ready: () => {},
      addClass: () => {},
      removeClass: () => {},
      toggleClass: () => {},
      attr: () => '',
      html: () => '',
      text: () => ''
    });
    mock$.ajaxSetup = () => {};
    mock$.cookie = () => {};
    mock$.post = () => {};
    mock$.get = () => {};

    const sandbox = {
      window: {
        location: { protocol: 'https:', host: 'morencius.com', hostname: 'morencius.com', href: embedUrl },
        innerHeight: 1080,
        innerWidth: 1920
      },
      document: {
        getElementById: mockElement,
        createElement: mockElement,
        querySelector: mockElement,
        body: { appendChild: () => {} }
      },
      $: mock$,
      jQuery: mock$,
      localStorage: {
        getItem: () => null,
        setItem: () => {}
      },
      jwplayer: (id) => {
        return {
          setup: (cfg) => {
            capturedConfig = cfg;
            capturedSources = cfg.sources || [];
            return {
              on: () => {},
              addButton: () => {},
              getAudioTracks: () => [],
              getPosition: () => 0,
              seek: () => {},
              play: () => {},
              pause: () => {},
              stop: () => {},
              load: () => {},
              once: () => {}
            };
          },
          key: '',
          on: () => {},
          addButton: () => {}
        };
      },
      console: { log: () => {} }
    };

    // Run in vm
    vm.createContext(sandbox);
    vm.runInContext(evalMatch[0], sandbox);

    console.log('[TEST] Captured sources:', JSON.stringify(capturedSources, null, 2));

    // Try fetching the stream
    if (capturedSources.length > 0) {
      let fileUrl = capturedSources[0].file;
      if (fileUrl.startsWith('/')) {
        fileUrl = 'https://morencius.com' + fileUrl;
      }
      console.log('[TEST] Testing HLS fetch for:', fileUrl);

      const hlsRes = await axios.get(fileUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Referer': embedUrl,
          'Origin': 'https://morencius.com'
        },
        timeout: 10000,
        maxRedirects: 5
      });

      console.log('[TEST] HLS status:', hlsRes.status);
      console.log('[TEST] HLS Content-Type:', hlsRes.headers['content-type']);
      console.log('[TEST] HLS Playlist preview:\n' + hlsRes.data.substring(0, 500));
    }

  } catch (err) {
    console.error('[TEST] Error:', err.message);
  }
}

testMorencius();
