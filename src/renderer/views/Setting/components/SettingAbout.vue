<template lang="pug">
dt#about {{ $t('setting__about') }}
dd
  .p.small
    strong LX Mod 桌面版 v{{ modVersion }}
    | &nbsp;· 二改作者：
    strong {{ modAuthor }}
  .p.small
    | 本软件完全免费。

dd
  .p.small 官方项目地址：
  .p.small
    span.link(:aria-label="$t('setting__click_open')" @click="openUrl(modGithubApp)") {{ modGithubApp }}

dd
  .p.small 如果本软件对你有所帮助，欢迎通过赞助支持项目的持续开发与维护。
  .p.small 感谢每一位支持本软件的用户。

dd
  h3 赞助项目
  div.sponsor
    .sponsorCard
      img.sponsorImg(:src="sponsorImage" alt="赞助码")
    .p.small.sponsorCaption 月下独酌版 赞助码

dd
  h3 注意事项
  div
    .p.small 本项目仅在 GitHub 与内部测试群进行开发、测试与信息交流，未在任何频道、群组、公众号、网站或平台进行官方推广、宣传或发布。
    .p.small 本项目不存在任何付费功能，也不会通过付费、充值、会员等方式限制软件功能，更不会把随处可见的东西包装成所谓「高级功能」进行收费。

dd
  .p.small
    | 你已签署本软件的
    base-btn(min @click="handleShowPact") 许可协议
    | 。
  .p.small
    | 协议在线版本：
    span.link(:aria-label="$t('setting__click_open')" @click="openUrl(modGithubApp)") {{ modGithubApp }}
  .p.small
    | 二改主页：
    span.link(:aria-label="$t('setting__click_open')" @click="openUrl(modDesktopUrl)") {{ modDesktopUrl }}
  br
  .p.small
    | 本软件基于洛雪音乐（LX Music）二次开发，遵循 Apache License 2.0。
  .p.small
    | By:&nbsp;
    strong 落雪无痕
    | &nbsp;· 二改：&nbsp;
    strong {{ modAuthor }}
</template>

<script>
import { isShowPact } from '@renderer/store'
import { openUrl } from '@common/utils/electron'
import { MOD_VERSION, MOD_AUTHOR, MOD_DESKTOP_URL, MOD_GITHUB_APP } from '@renderer/core/mod/meta'
import sponsorImage from '@renderer/assets/images/sponsor.png'

export default {
  name: 'SettingAbout',
  setup() {
    const handleShowPact = () => {
      isShowPact.value = true
    }
    return {
      openUrl,
      handleShowPact,
      sponsorImage,
      modVersion: MOD_VERSION,
      modAuthor: MOD_AUTHOR,
      modGithubApp: MOD_GITHUB_APP,
      modDesktopUrl: MOD_DESKTOP_URL,
    }
  },
}
</script>

<style lang="less" module>
.sponsor {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.sponsorCard {
  padding: 8px;
  background: #fff;
  border: 1px solid var(--color-border, rgba(128, 128, 128, .28));
  border-radius: 10px;
  line-height: 0;
}
.sponsorImg {
  display: block;
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: 6px;
}
.sponsorCaption {
  margin-top: 6px;
  color: var(--color-font-label);
}
.link {
  color: var(--color-primary);
  cursor: pointer;
  word-break: break-all;
  &:hover { text-decoration: underline; }
}
</style>
