/**
 * Uptime Kuma 监控状态检查
 *
 * 方案: 用 /api/badge/:id/status SVG 接口, 枚举所有 ID
 * 优点: 不需要 auth, 能拿到所有 monitor 状态 (包括 paused/maintenance)
 *
 * 适用环境: Surge / Stash / Shadowrocket
 *
 * 配置: 修改下方 MONITOR_IDS 数组, 填入你的监控项 ID
 */

const HOST = "https://uptime.xiangfang-ai.com";
// 你的监控项 ID 列表 (按需增减, 共 11 个)
const MONITOR_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
// 并发数, 太大可能被限流
const CONCURRENCY = 4;

async function checkOne(id) {
    const req = {
        url: `${HOST}/api/badge/${id}/status`,
        headers: { "Accept": "image/svg+xml" },
    };
    try {
        const resp = await $task.fetch(req);
        if (resp.statusCode !== 200) {
            return { id, status: "ERR", msg: `HTTP ${resp.statusCode}` };
        }
        // SVG 格式: aria-label="Status: Up" 或 "Status: Down" 等
        const m = resp.body.match(/aria-label="Status: ([^"]+)"/);
        if (!m) {
            return { id, status: "ERR", msg: "解析失败" };
        }
        return { id, status: m[1] };
    } catch (e) {
        return { id, status: "ERR", msg: e.error || "网络异常" };
    }
}

async function runPool(ids, limit) {
    const results = [];
    const queue = ids.slice();
    const workers = Array.from({ length: limit }, async () => {
        while (queue.length) {
            const id = queue.shift();
            results.push(await checkOne(id));
        }
    });
    await Promise.all(workers);
    return results;
}

(async () => {
    const results = await runPool(MONITOR_IDS, CONCURRENCY);

    const STATUS_MAP = {
        "Up": { icon: "🟢", text: "正常" },
        "Down": { icon: "🔴", text: "故障" },
        "Pending": { icon: "🟡", text: "等待" },
        "Maintenance": { icon: "🔵", text: "维护" },
    };

    const downList = [];
    const errList = [];
    let up = 0;

    for (const r of results) {
        if (r.status === "Up") {
            up++;
        } else if (r.status === "Down") {
            downList.push(`#${r.id} 故障`);
        } else if (r.status === "Pending") {
            downList.push(`#${r.id} 等待中`);
        } else if (r.status === "Maintenance") {
            downList.push(`#${r.id} 维护中`);
        } else {
            errList.push(`#${r.id} ${r.msg}`);
        }
    }

    if (errList.length > 0) {
        $notify(
            "🔴 Kuma 请求异常",
            `${up} 正常 / ${errList.length} 失败`,
            errList.join("\n")
        );
    } else if (downList.length > 0) {
        $notify(
            `🔴 Kuma ${downList.length} 异常`,
            `${up}/${MONITOR_IDS.length} 正常`,
            downList.join("\n")
        );
    } else {
        $notify(
            "🟢 Kuma 全部正常",
            `${up}/${MONITOR_IDS.length} 在线`,
            ""
        );
    }
    $done();
})();
