/**
 * Uptime Kuma 监控状态检查
 * 通过 Prometheus /metrics 获取所有监控项状态
 * 状态码: 1=UP, 0=DOWN, 2=PENDING, 3=MAINTENANCE
 *
 * 适用环境: Surge / Stash / Shadowrocket
 */

const host = "https://uptime.xiangfang-ai.com";
// Basic Auth: base64("user:uk2_mQwJQOBK7WpLCzZjlYtReXF_eDDNRn56ypKY2US5")
const authBase64 = "dXNlcjp1azJfbVF3SlFPQks3V3BMQ3paamxZdFJlWEZfZURETlJuNTZ5cEtZMlVTNQ==";

const myRequest = {
    url: host + "/metrics",
    headers: {
        "Authorization": "Basic " + authBase64
    }
};

$task.fetch(myRequest).then(response => {
    if (response.statusCode !== 200) {
        $notify("🔴 Kuma 请求异常", "", "HTTP " + response.statusCode);
        $done();
        return;
    }

    const lines = response.body.split("\n");
    const downList = [];
    let total = 0;

    for (const line of lines) {
        if (!line.startsWith("monitor_status{")) continue;
        total++;

        const value = parseInt(line.split("} ")[1]);
        if (value === 1) continue; // UP

        const name = line.match(/monitor_name="([^"]+)"/)?.[1] || "未知";
        const tag = value === 0 ? "DOWN" : value === 2 ? "PENDING" : "维护";
        downList.push(name + " [" + tag + "]");
    }

    if (downList.length > 0) {
        $notify(
            "🔴 Kuma " + downList.length + "/" + total + " 异常",
            "",
            downList.join("\n")
        );
    } else {
        $notify("🟢 Kuma 正常", "", "全部 " + total + " 个服务在线");
    }

    $done();
}, reason => {
    $notify("🔴 Kuma 无法连接", "", "请求失败: " + (reason.error || "网络异常"));
    $done();
});
