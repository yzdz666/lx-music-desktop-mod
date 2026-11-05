<template lang="pug">
dt#about {{ $t('setting__about') }}
dd
  .p.small
    strong LX Mod 桌面版 v{{ modVersion }}
    | &nbsp;· 二改作者：
    strong {{ modAuthor }}
    | （QQ {{ modQQ }}）
  .p.small
    | 二改新增：我的音乐（网易云 / QQ / 酷狗）、云盘（网易云 + WebDAV）、本地音乐、一起听（含网页版）、平台设置、全音质支持。
  .p.small
    | 二改版主页：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl(modHomeUrl)") {{ modHomeUrl }}
  .p.small
    | 电脑版下载 / 源码：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl(modDesktopUrl)") {{ modDesktopUrl }}
  .p.small
    | 二改源码仓库：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl(modGithubApp)") {{ modGithubApp }}
  br
  .p.small
    | 本软件完全免费，代码已开源。开源地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop#readme')") https://github.com/lyswhut/lx-music-desktop
  .p.small
    | 最新版下载地址：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop/releases')") GitHub Releases
  .p.small
    | 软件的常见问题可转至：
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://lyswhut.github.io/lx-music-doc/desktop/faq')") 桌面版常见问题
  .p.small
    strong 本软件没有客服
    | ，但我们整理了一些常见的使用问题。
    strong 仔细、仔细、仔细
    | 地阅读常见问题后，
  .p.small
    | 仍有问题可到&nbsp;GitHub&nbsp;
    span.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop/issues?q=is%3Aissue+')") 提交&nbsp;Issue
    | 。
  br
  .p.small 由于软件开发的初衷仅是为了对新技术的学习与研究，因此软件直至停止维护都将会一直保持纯净。
  .p.small
    | 目前本项目的原始发布地址
    strong 只有&nbsp;GitHub
    | ，其他渠道均为第三方转载发布，可信度请自行鉴别。
  .p.small
    strong 本项目没有微信公众号之类的所谓「官方账号」，谨防被骗！

  .p.small
    | 你已签署本软件的
    base-btn(min @click="handleShowPact") 许可协议
    | ，协议的在线版本在
    strong.hover.underline(:aria-label="$t('setting__click_open')" @click="openUrl('https://github.com/lyswhut/lx-music-desktop#%E9%A1%B9%E7%9B%AE%E5%8D%8F%E8%AE%AE')") 这里
    | 。
  br

  .p.small
    | By:&nbsp;
    strong 落雪无痕
</template>

<script>
// import { ref, onBeforeUnmount } from '@common/utils/vueTools'
import { isShowPact } from '@renderer/store'
import { openUrl, clipboardWriteText } from '@common/utils/electron'
import { MOD_VERSION, MOD_AUTHOR, MOD_QQ, MOD_HOME_URL, MOD_DESKTOP_URL, MOD_GITHUB_APP } from '@renderer/core/mod/meta'

export default {
  name: 'SettingAbout',
  setup() {
    const handleShowPact = () => {
      isShowPact.value = true
    }
    return {
      openUrl,
      clipboardWriteText,
      handleShowPact,
      modVersion: MOD_VERSION,
      modAuthor: MOD_AUTHOR,
      modQQ: MOD_QQ,
      modHomeUrl: MOD_HOME_URL,
      modDesktopUrl: MOD_DESKTOP_URL,
      modGithubApp: MOD_GITHUB_APP,
    }
  },
}
</script>
