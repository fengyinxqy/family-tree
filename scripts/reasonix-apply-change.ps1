param(
    [Parameter(Mandatory = $true)]
    [string]$ChangeName,

    [string]$Model = "deepseek-pro/deepseek-v4-pro",

    [int]$MaxSteps = 0
)

$reasonixCmd = Join-Path $env:LOCALAPPDATA "nvs\default\reasonix.cmd"
if (-not (Test-Path $reasonixCmd)) {
    $cmd = Get-Command reasonix.cmd -ErrorAction SilentlyContinue
    if ($cmd) {
        $reasonixCmd = $cmd.Source
    } else {
        throw "reasonix.cmd not found. Install Reasonix or update the script path."
    }
}

$prompt = @"
你现在是在 D:\programing\family 仓库里执行实现任务。请只做实现，不做产品范围扩张。

目标 change: $ChangeName

必须遵守：
1. 先运行 `openspec status --change "$ChangeName" --json`。
2. 再运行 `openspec instructions apply --change "$ChangeName" --json`。
3. 读取 apply 指令中列出的全部 contextFiles。
4. 仅实现 pending tasks；不要修改 proposal、design、spec，除非实现被阻塞并且你需要明确记录 blocker。
5. 如果会修改 Next.js 代码，先阅读 `node_modules/next/dist/docs/` 下与本次改动相关的文档，再动手。
6. 保持改动最小且聚焦；不要顺手重构无关代码。
7. 完成每个任务后，更新 tasks.md 中对应的复选框。
8. 至少运行 `npm run lint` 和 `npx tsc --noEmit`；如果改动影响测试，再运行 `npm test`。
9. 最终输出：本次完成的任务、修改过的文件、验证结果、剩余风险。

如果遇到设计缺口、需求冲突或实现阻塞，不要硬猜，停下来并明确说明 blocker。
"@

& $reasonixCmd run --model $Model --max-steps $MaxSteps $prompt
