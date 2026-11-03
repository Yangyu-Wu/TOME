# MicroRTS 实验仪表盘

运行 `./web/start-dashboard.ps1` 后，打开 http://127.0.0.1:4173 。

页面只读取 `logs/microrts/agent/run-*.json`，不会修改实验数据；支持按对手筛选、查看胜率/配置/决策时间线，并打开已保存的回放。新实验加上 `--save-replay --frame-interval 10` 即会生成可在页面中打开的回放。服务仅监听本机。
