const $ = id => document.getElementById(id);
let viewer, modelUrl, loading = false;
let startedAt = 0;
const setStatus = message => { $('status').lastChild.textContent = message; };
function showInfo(open) { $('info').hidden = !open; $('info-toggle').setAttribute('aria-expanded', String(open)); }
$('info-toggle').onclick = () => showInfo($('info').hidden);
$('info-close').onclick = () => showInfo(false);
document.addEventListener('keydown', e => { if (e.key === 'Escape') showInfo(false); });
$('reset').onclick = () => { viewer?.resetCamera(); document.querySelectorAll('.preset').forEach(x => x.classList.remove('active')); };
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setStatus('请使用浏览器全屏'); } };
document.querySelectorAll('.preset').forEach(button => button.onclick = () => {
  viewer?.selectAnnotation(Number(button.dataset.index));
  document.querySelectorAll('.preset').forEach(x => x.classList.toggle('active', x === button));
});
function progress(received, total) {
  const fraction = Math.min(received / total, 1);
  $('progress-bar').style.width = `${fraction * 100}%`;
  const mb = n => (n / 2**20).toFixed(1);
  $('progress-text').textContent = `下载模型 ${Math.floor(fraction * 100)}% · ${mb(received)} / ${mb(total)} MiB`;
}
async function download(manifest) {
  const buffers = new Array(manifest.parts.length);
  const downloaded = new Array(manifest.parts.length).fill(0);
  let next = 0;
  const update = () => progress(downloaded.reduce((a, b) => a + b, 0), manifest.bytes);
  async function worker() {
    while (next < manifest.parts.length) {
      const i = next++, part = manifest.parts[i];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          downloaded[i] = 0;
          const response = await fetch(new URL(part.url, document.baseURI), {signal: AbortSignal.timeout(240000)});
          if (!response.ok) throw new Error(`模型分片 HTTP ${response.status}`);
          const reader = response.body.getReader();
          const data = new Uint8Array(part.bytes);
          let cursor = 0;
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            if (cursor + value.length > data.length) throw new Error('模型分片大小不符');
            data.set(value, cursor); cursor += value.length; downloaded[i] = cursor; update();
          }
          if (cursor !== part.bytes) throw new Error('模型分片下载不完整');
          const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', data)), x => x.toString(16).padStart(2, '0')).join('');
          if (hash !== part.sha256) throw new Error('模型分片校验失败');
          buffers[i] = data;
          break;
        } catch (e) {
          downloaded[i] = 0; update();
          if (attempt === 2) throw e;
          $('progress-text').textContent = '网络暂时中断，正在自动重试…';
          await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return URL.createObjectURL(new Blob(buffers, {type:'application/octet-stream'}));
}
async function start() {
  if (loading) return;
  loading = true; startedAt = performance.now();
  $('load-button').hidden = true; $('retry').hidden = true; $('error').textContent = '';
  $('progress-wrap').hidden = false; setStatus('下载场景中');
  try {
    const [manifestResponse, settingsResponse, module] = await Promise.all([
      fetch('./model/manifest.json'), fetch('./settings.json'), import('./vendor/viewer.js')
    ]);
    if (!manifestResponse.ok || !settingsResponse.ok) throw new Error('场景配置加载失败');
    const manifest = await manifestResponse.json(), settings = await settingsResponse.json();
    modelUrl = await download(manifest);
    $('progress-text').textContent = '下载完成，正在准备 GPU 和三维场景…'; setStatus('准备渲染');
    viewer = await module.createViewer({container:$('scene'), settings, contentUrl:modelUrl,
      contentFilename:'truck.compressed.ply', renderer:'webgl', noanim:true, nofx:true, ui:true, exposeGlobals:false});
    const ready = () => {
      if (!viewer.state.loaded) return;
      $('loading').hidden = true; $('tools').hidden = false; $('hint').hidden = false;
      viewer.state.showAnnotations = false;
      setStatus('场景已就绪');
      document.documentElement.dataset.sceneLoaded = 'true';
      console.info('Truck scene ready', {seconds:(performance.now()-startedAt)/1000, gaussians:manifest.gaussians});
    };
    viewer.events.on('loaded:changed', ready);
    ready();
    viewer.events.on('error:changed', message => { if (message) fail(new Error(String(message))); });
  } catch (e) { fail(e); }
}
function fail(error) {
  console.error(error); viewer?.destroy(); viewer = undefined;
  if (modelUrl) { URL.revokeObjectURL(modelUrl); modelUrl = undefined; }
  loading = false; $('loading').hidden = false; $('retry').hidden = false;
  $('error').textContent = `加载未完成：${error.message}。可重试；若提示显卡或纹理限制，请在电脑上开启硬件加速后打开。`;
  setStatus('加载未完成');
}
$('load-button').onclick = start;
$('retry').onclick = start;
