# 平台适配层

核心模块只依赖普通 JavaScript 数据结构。各平台实现以下接口即可：

- `StoragePort`: `load(key)` / `save(key, value)`
- `Renderer`: 订阅 `GameApp` 状态并绘制
- `InputAdapter`: 将点击、触摸、手柄操作转换为 `GameApp` 方法
- `Clock`: 按固定时间步调用 `app.tick(deltaSeconds)`

当前 `BrowserStorage` 是 Web 实现。Windows、iOS、Android 可分别替换为文件、SQLite、UserDefaults/Keychain 或 SharedPreferences 实现，而无需修改战斗规则。
