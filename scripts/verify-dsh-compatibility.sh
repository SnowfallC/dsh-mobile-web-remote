#!/usr/bin/env bash
set -Eeuo pipefail

# 本脚本验证插件依赖的最小 DSH 兼容边界，不连接真实公网隧道。
workspaceRoot="${GITHUB_WORKSPACE:-$(pwd)}"
pluginRoot="${PLUGIN_ROOT:-${workspaceRoot}/plugin}"
dshRoot="${DSH_ROOT:-${workspaceRoot}/deepseek-harness}"
runtimeRoot="${RUNNER_TEMP:-${workspaceRoot}/.tmp-dsh-compatibility}"
logFile="${runtimeRoot}/dsh-web.log"
cookieFile="${runtimeRoot}/cookies.txt"
fakeCloudflared="${pluginRoot}/scripts/fixtures/fake-cloudflared.mjs"
dshPort="${DSH_COMPAT_PORT:-3080}"
bridgePort="${DSH_COMPAT_BRIDGE_PORT:-31888}"
dshPid=""

mkdir -p "${runtimeRoot}" "${DSH_HOME:?DSH_HOME must be set}"
chmod +x "${fakeCloudflared}"

printSanitizedLog() {
  if [[ -f "${logFile}" ]]; then
    sed -E 's/#token=[A-Za-z0-9_-]+/#token=[REDACTED]/g' "${logFile}" >&2
  fi
}

fail() {
  echo "兼容性检查失败：$1" >&2
  printSanitizedLog
  exit 1
}

cleanup() {
  if [[ -n "${dshPid}" ]] && kill -0 "${dshPid}" 2>/dev/null; then
    kill "${dshPid}" 2>/dev/null || true
    wait "${dshPid}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

(
  cd "${dshRoot}"
  pnpm dsh plugin --profile web add "${pluginRoot}"
)

# 固定隔离测试的桥接端口，避免从 DSH 日志猜测随机监听端口。
printf '%s\n' \
  '- id: mobile-web-remote' \
  '  config:' \
  "    bridgePort: ${bridgePort}" \
  >"${DSH_HOME}/profiles/web/cordis.patch.yml"

(
  cd "${dshRoot}"
  DSH_CLOUDFLARED_PATH="${fakeCloudflared}" pnpm dsh web --port "${dshPort}"
) >"${logFile}" 2>&1 &
dshPid="$!"

bridgeUrl="http://127.0.0.1:${bridgePort}"
pairingToken=""
for _ in $(seq 1 120); do
  kill -0 "${dshPid}" 2>/dev/null || fail "DSH Web 进程提前退出"
  pairingToken="$(grep -Eo 'https://compatibility-check\.trycloudflare\.com/#token=[A-Za-z0-9_-]+' "${logFile}" 2>/dev/null | tail -n 1 | sed 's/.*#token=//' || true)"
  if [[ -n "${pairingToken}" ]]; then
    break
  fi
  sleep 1
done

[[ -n "${pairingToken}" ]] || fail "未生成一次性配对令牌"

desktopHtml="$(curl --fail --silent --show-error "http://127.0.0.1:${dshPort}/")" || fail "无法访问 DSH Web 首页"
grep -q 'data-dsh-mobile-control' <<<"${desktopHtml}" || fail "桌面悬浮入口未注入"

managementHtml="$(curl --fail --silent --show-error "http://127.0.0.1:${dshPort}/__dsh_mobile")" || fail "无法访问管理页"
grep -q '<svg' <<<"${managementHtml}" || fail "管理页未生成二维码"
grep -q '/__dsh_mobile/revoke' <<<"${managementHtml}" || fail "管理页缺少撤销入口"

pairingHtml="$(curl --fail --silent --show-error "${bridgeUrl}/")" || fail "无法访问未授权桥接页"
grep -q '/__dsh_mobile/pair' <<<"${pairingHtml}" || fail "未授权桥接页缺少配对逻辑"

pairStatus="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  --cookie-jar "${cookieFile}" \
  --header 'content-type: application/json' \
  --header 'x-forwarded-proto: https' \
  --data "{\"token\":\"${pairingToken}\"}" \
  "${bridgeUrl}/__dsh_mobile/pair")" || fail "配对请求失败"
[[ "${pairStatus}" == "204" ]] || fail "配对接口返回 ${pairStatus}，预期为 204"

remoteHtml="$(curl --fail --silent --show-error --cookie "${cookieFile}" "${bridgeUrl}/")" || fail "无法访问已授权远程首页"
grep -q 'name="dsh-mobile-web-remote"' <<<"${remoteHtml}" || fail "远程页面缺少插件标记"
grep -q 'data-dsh-mobile-restrictions' <<<"${remoteHtml}" || fail "远程限制脚本未注入"
grep -q 'settings.trigger' <<<"${remoteHtml}" || fail "远程设置限制未保留"

echo "最新 DSH main 的插件安装、入口注入、配对鉴权及远程限制检查通过。"
