# Truck · 3DGS 场景分享

使用 GitHub Pages 分享自己训练的 Truck 30,000 步高斯场景。网页位于 `docs/`，无需服务器端 GPU、账号登录或模型训练环境；浏览器使用访客设备的 GPU 渲染。

## 访问和操作

GitHub Pages： https://causcocharles.github.io/truck-3dgs-viewer/

进入页面后点击“进入三维场景”。左键拖动旋转、右键拖动平移、滚轮缩放；底部可切换三个视角、重置、全屏。建议使用支持 WebGL2 且开启硬件加速的桌面浏览器。

## 数据与质量边界

- 输入为自己训练的 3DGS `point_cloud.ply`，2,574,495 个高斯、SH 阶数3、训练30,000步。
- 原始 PLY 为638,476,292字节，不提交到仓库。网页使用 PlayCanvas compressed PLY 量化副本，保留全部高斯和SH阶数，但数值不是逐字节无损。
- 模型分为不超过32MiB的静态分片，避免GitHub普通单文件100MiB限制；浏览器自动下载、校验SHA256并拼接，每个分片失败自动重试。分片仅改变传输，不改变模型内容。
- 原始模型32个测试视角（979×546）评测：PSNR25.4114dB、SSIM0.882174、LPIPS0.146659。未对网页压缩版重新测量这些指标，网页效果不应当作官方CUDA评测的逐像素复现。
- 首次完整模型下载约157.8MB（150.5MiB）；2.57M高斯对显存及内存有一定要求，移动设备体验因设备而异。

## 本地复现网页构建

1. `npm ci` 安装锁定依赖。
2. 把原始模型放到本仓库上两层的 `point_cloud.ply`（或替换下面输入路径）。
3. 创建 `.cache/` 后运行：

```bash
npx splat-transform ../../point_cloud.ply .cache/truck.compressed.ply
npm run build
python -m http.server 8765 --directory docs --bind 127.0.0.1
```

4. 打开 http://127.0.0.1:8765 。

GitHub Pages配置为从`main`分支的`/docs`发布；原始数据、环境包、checkpoint和凭据均不上传。

## 来源

- 原始方法：[3D Gaussian Splatting for Real-Time Radiance Field Rendering](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)，Kerbl等，SIGGRAPH2023。
- 训练源码：graphdeco-inria/gaussian-splatting，固定提交`b2ada78a779ba0455dfdc2b718bdf1726b05a1b6`，保留宿主编译器参数`-fno-gnu-unique`修改；展示不包含官方训练代码。
- 场景来自Tanks and Temples的Truck，COLMAP输入来自3DGS官方发布数据；用于科研学习展示。
- 查看器：PlayCanvas SuperSplat Viewer1.41.0；转换器：SplatTransform3.10.3。相关MIT许可及第三方声明保留在`docs/vendor/`。

此仓库是研究展示，不代表原论文作者或数据集作者官方站点。
