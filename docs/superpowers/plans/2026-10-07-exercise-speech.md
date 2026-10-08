# 动作步骤朗读 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 默认顺序执行；共享朗读控制器、详情弹层和训练页不并行修改。

**Goal:** 用户在动作详情和训练页点击讲解按钮，即可用设备本地语音听现有动作步骤，并能暂停、继续、重播；切换动作、关闭入口或结束训练不串音。

**Architecture:** 使用浏览器原生 Web Speech API，复用现有多语言动作步骤，音频与 Vital MP4/GIF 独立。一个模块管理全应用唯一朗读任务，一个 React 控件复用在两个入口；播放状态只存在内存。训练页提供默认关闭的“本次自动讲解”开关，不改训练数据模型，不接云端 TTS。

**Tech Stack:** React 19、现有 Vitest/happy-dom、`SpeechSynthesis` / `SpeechSynthesisUtterance`，零新增依赖。

**Spec:** 本文件 §1 是需求与决策基线，来自本次用户确认的“设备实时朗读”建议；不是已实现功能的说明。

## Global Constraints

- 在现有 `feat/vitalanimations-media` 分支执行；当前媒体改动尚未提交，用户已有 iOS 修改必须保留，不执行全量暂存、重置或覆盖。
- 保留原有 1,324 个动作及 ID、中文步骤、Vital 映射、GIF 回退、视频缓存和 MP4 字节范围行为。
- 不新增前端/API 依赖，不新增云账号、网络 TTS、后端接口、音频文件或用户训练数据字段。
- 不将朗读合成进 MP4；视频保持静音并可循环，讲解只读一遍。
- 默认不自动外放；不能因为打开详情、刷新页面、视频开始播放或语言包加载完成就启动朗读。
- 当前语言缺少步骤、缺少匹配的本地语音或合成失败时，显示真实原因，保留文字/视频；不得偷偷用英文或远程语音替代。
- 不承诺锁屏/后台播放。页面进入后台时主动停止，回来后不自动恢复。
- 移动壳中的 Web Speech 能力尚未实测；网页通过不等于 iOS/Android 壳通过。
- 每个代码任务执行有意义的定向测试；最后统一执行构建、回归和真实浏览器/设备验收。本文的预期结果不是已经运行的结果。

---

## 1. 需求、边界与明确决策

### 1.1 用户能看到和使用什么

1. **详情入口：** 在 `ExerciseDetail` 的 `<Media ex={ex} />` 之后放“讲解”控件，不再要求用户滚到原有 `How to` 列表底部。原文字步骤保留。
2. **训练入口：** 在 `ExerciseBlock` 的动作标题下面放同一个控件。Cards、List、Compact、超级组均能使用；即使 `gifSize='off'`、动作无视频或媒体下载失败，也不影响朗读。
3. **播放控制：** 空闲显示“讲解”；播报中显示“暂停”“停止”“重播”；暂停后显示“继续”“停止”“重播”；结束后显示“重播”。
4. **继续的语义：** 从被暂停的当前步骤开头重读，不承诺精确到暂停时的字。按步骤创建 utterance，暂停用 `cancel()` 终止当前步骤，再继续该步骤，避免依赖不同平台表现不一致的原生 pause/resume。
5. **内容：** 原有步骤按顺序完整朗读，不引入模型摘要，不自动删除注意事项，不读双语动作名中的英文括号。当前步骤文字同步显示在控件下方；不做视频时间轴同步或逐字字幕。
6. **独立控制：** 暂停视频不暂停讲解，暂停讲解不暂停视频；视频每次循环不重播讲解。
7. **自动讲解：** 训练页提供“本次自动讲解”，默认关，只在本次挂载的训练界面生效。用户主动打开时，直接在点击回调中读当前动作；本次训练每个动作 ID 最多自动讲解一次，同 ID 的重复 entry 和返回已听动作不再自动重读，手动重播不受限制。刷新、离开训练页、结束训练、进入后台、切换语言或播放错误均关闭本次自动模式。无需保存到 Settings 或服务器。
8. **不改文本来源：** 复用当前动作步骤；对术语读音和安全注意事项做抽样人工核对。全量重译、改写成短配音稿不在本计划范围。

### 1.2 设备能力和隐私

- 只选择 `voice.localService === true` 且语言匹配的声音。没有本地中文声音时提示安装/启用设备中文语音；不能为了“能响”选择英语或远程声音。
- 声音选择顺序：规范化 `_` 为 `-` 后的完整语言标签匹配，随后同语言主标签匹配；同等级优先设备 default 声音，最后采用设备列表顺序。
- 使用现有 `dateLocale()` 给当前语言提供地区标签，如 `zh-CN`、`en-GB`、`pt-BR`；`baseLang()` 用于判断步骤语言是否属于当前界面语言。
- `getVoices()` 初次可能为空。入口挂载时读取，并监听 `voiceschanged` 更新可用性；“暂无本地语音，检查设备语音设置”不等于永远不支持，声音出现后入口应恢复可用。
- 用户的点击回调必须同步调用 `speak()`，不要先 `await` 语言加载、语音加载或网络请求；无法立即播放时提示用户稍后再点，不保存待自动启动的请求。
- Web Speech 的本地标记不代替离线验收。只有飞行模式实际听到声音，才能报告该设备离线可用。
- 不新增 `navigator.audioSession` 配置或修改已有 `sound.js`。定时器 Sounds、静音开关和音乐共存行为维持现状，在真机验收中记录实际表现。

### 1.3 已核对的代码事实

| 位置 | 当前行为 | 对计划的影响 |
|---|---|---|
| `frontend/src/lib/i18n-core.js:77-78` | `instrFor(ex)` 优先当前步骤包，缺失则回退 `ex.st` | 新增步骤来源元数据，不能把英文回退误当中文读 |
| `frontend/src/lib/i18n.js:30-55` | 语言/步骤包异步加载，`useLang()` 通知组件 | 切换语言立即停播，等待完整包后才能启动新语言 |
| `frontend/src/sheets.jsx:799-840` | 详情先展示媒体，文字步骤在器械/1RM 区域之后 | 新入口紧邻媒体，原列表不移除 |
| `frontend/src/views/Workout.jsx:95,498-507` | `ExerciseBlock` 共用于 Cards/List/Compact/超级组 | 朗读入口放标题下，而非藏进 Media |
| `frontend/src/views/Workout.jsx:1304-1321` | SwipeCards 预览也创建 ExerciseBlock | 预览必须标为惰性，不注册停止逻辑、不自动播放 |
| `frontend/src/views/Workout.jsx:651-678` | ActiveWorkout 通过 `A.cur` 定位当前动作 | 自动播报跟随真实当前动作，不依赖视频事件或滚动可见性 |
| `frontend/src/App.jsx:63-103` | Shell 持有路由、语言选择和 useLang 订阅 | 在此接全局离开/语言/后台停止 |
| `frontend/src/lib/sound.js` | 已有定时器音频解锁及 iOS audioSession 行为 | 不把 Web Audio 的 unlock 当成 Web Speech 授权 |
| `frontend/scripts/check-locales.mjs` | 所有 locale 文件必须有相同 key 集合 | 新文案必须补齐所有现有语言包，不只加 zh |

## 2. 文件与接口约定

### 2.1 文件职责

| 文件 | 操作 | 职责 |
|---|---|---|
| `frontend/src/lib/i18n-core.js` | 修改 | 新增 `instructionInfoFor(ex)`，提供步骤真实语言；原 `instrFor` 保持兼容 |
| `frontend/src/lib/i18n.js` | 修改 | 重导出新 reader，继续使用现有 `useLang` |
| `frontend/src/lib/i18n-core.test.js` | 修改 | 翻译来源和英文回退的行为回归 |
| `frontend/src/lib/exercise-speech.js` | 新建 | 声音选择、唯一任务、逐步骤播报、取消和竞态保护 |
| `frontend/src/lib/exercise-speech.test.js` | 新建 | 单任务、暂停继续、旧回调、声音可用性及错误行为 |
| `frontend/src/components/ExerciseSpeech.jsx` | 新建 | 共享按钮、当前步骤和原因提示；不负责自动播报 |
| `frontend/src/components/ExerciseSpeech.test.jsx` | 新建 | 可见控制和多入口所有权行为 |
| `frontend/src/sheets.jsx` | 修改 | 详情媒体之后插入入口 |
| `frontend/src/views/Workout.jsx` | 修改 | 各布局入口、惰性预览、本次自动模式、动作切换生命周期 |
| `frontend/src/views/Workout.speech.test.jsx` | 新建 | 真实训练状态转换下的停播和自动播报边界 |
| `frontend/src/App.jsx` | 修改 | 路由/语言/后台停止与恢复边界 |
| `frontend/src/locales/*.js` | 修改全部现有 16 个文件 | 新文案的翻译，派生 de-CH 不新增独立包 |
| `docs/FAQ.md`、`docs/MOBILE.md`、`CHANGELOG.md` | 验收后修改 | 用户使用说明、能力限制和变更记录 |

优先复用 `components/ui.jsx` 的 Button、Switch 和现有 row/小字样式；不添加新图标包。`Media.jsx`、API、SW、原生工程和 Zustand 持久化结构不需要改变。

### 2.2 精确接口

```js
// i18n-core.js（也从 i18n.js 导出）
// 与 instrFor 同样的来源优先级；steps 引用原数组，不复制。
// lang: 当前步骤包来源语言，英文 ex.st 回退为 'en'；无内容为 null。
// 自定义动作未经标注的 ex.st 为 null，不猜测它的语言。
instructionInfoFor(ex) // -> { steps: string[], lang: string | null }

// exercise-speech.js：模块级唯一任务，不导出 controller factory。
chooseSpeechVoice(voices, lang) // -> SpeechSynthesisVoice | null
speechAvailability(lang) // -> null | 'unsupported' | 'voice-missing'
subscribeSpeech(listener) // -> unsubscribe function
getSpeechSnapshot() // -> 稳定引用的下述快照；有变化才更换对象
startSpeech({ owner, exerciseId, steps, lang }) // -> boolean，成功提交 true
pauseSpeech(owner) // 只操作 owner 当前任务
resumeSpeech(owner) // 当前步骤开头重新朗读
stopSpeech(owner) // owner 缺省为全局停止；owner 不匹配则不操作
```

```js
// owner 是入口用 useId() 生成的稳定字符串；不能只用 exerciseId，
// 否则同一动作的训练卡和详情弹层互相卸载时会误停另一个入口。
{
  owner: null, exerciseId: null,
  status: 'idle', // idle | starting | speaking | paused | ended | error
  stepIndex: 0,
  error: null, // unsupported | voice-missing | not-allowed | synthesis-failed
  voicesVersion: 0
}

// React 控件；preview 为 true 时返回 null，不注册播放/清理。
<ExerciseSpeech ex={ex} preview={false} />
```

内容缺失或来源语言不匹配的提示由控件处理，不调用 startSpeech。`startSpeech` 仍验证 `steps` 为非空字符串数组、存在匹配本地声音及 API；不把无效文本传给系统。保持 utterance 的强引用到当前步骤结束，避免某些引擎提前丢弃任务。

## 3. 顺序执行任务

### Task 1：明确步骤语言，防止中文入口朗读英文回退

**Files:** 修改 `lib/i18n-core.js`、`lib/i18n.js`、`lib/i18n-core.test.js`（均在 `frontend/src/`）。

**Interfaces:** 产生 `instructionInfoFor(ex)`；不改变既有 `instrFor(ex)` 的返回值或回退规则。

- [ ] 先用语言 core 的 `_setLangState` 写回归测试，测试结束恢复英文状态，避免污染现有用例。至少包含中文命中、中文包漏项回退英文、空步骤和自定义动作未知语言。

```js
it('reports English fallback instead of labelling it Chinese', () => {
  const ex = { id: '0043', st: ['Stand with feet shoulder-width apart.'] }
  try {
    _setLangState('zh', {}, {}, null)
    expect(instructionInfoFor(ex)).toEqual({ steps: ex.st, lang: 'en' })
  } finally {
    _setLangState('en', {}, null, null)
  }
})
```

- [ ] Run: `npm test -- src/lib/i18n-core.test.js`，工作目录 `frontend`；新增 reader 未实现时新用例应失败。
- [ ] 按现有 `(instr && instr[ex.id]) || ex.st || []` 优先级实现 reader：翻译数组命中返回 `baseLang(getLang())`；内置英文回退返回 `en`；无步骤或自定义未知来源返回 `null`。不要通过正则猜语言，不改现有文字展示。
- [ ] 在浏览器 shell 重导出，并验证中文声音入口只接受步骤来源与 `baseLang(getLang())` 一致的数据。异步 pack 未加载时不允许用英文抢先播报。
- [ ] 运行同一定向测试；若要提交，只暂存本任务明确文件，不带入现有媒体或 iOS 改动。

### Task 2：实现唯一朗读任务与逐步骤状态转换

**Files:** 新建 `lib/exercise-speech.js`、`lib/exercise-speech.test.js`。

**Interfaces:** 实现 §2.2 所有 speech 模块接口；不依赖 React、Zustand 或后端。

- [ ] 编写确定性测试：通过 `vi.stubGlobal` 提供可触发 onstart/onend/onerror 的系统语音边界，afterEach 停止、还原 globals 和模块状态。只模拟平台边界，不模拟被测控制器。
- [ ] 必测行为：同一应用只播一个入口；暂停后旧 onend 不前进；继续从当前步骤开头读；重播由 startSpeech 重新从步骤 0 开始；停止/新任务后旧错误不能覆盖新任务；非所有者 cleanup 不能停播；本地同语言声音优先且不能降级英文/远程。

```js
import { beforeEach, afterEach, it, expect, vi } from 'vitest'

let speech, utterances, platform
beforeEach(async () => {
  vi.resetModules()
  utterances = []
  platform = new EventTarget()
  platform.getVoices = () => [{
    name: 'Local Mandarin', lang: 'zh-CN', localService: true, default: true
  }]
  platform.speak = u => { utterances.push(u) }
  platform.cancel = () => {}
  vi.stubGlobal('speechSynthesis', platform)
  vi.stubGlobal('SpeechSynthesisUtterance', class {
    constructor(text) { this.text = text }
  })
  speech = await import('./exercise-speech.js')
})
afterEach(() => {
  speech?.stopSpeech()
  vi.unstubAllGlobals()
})

it('ignores the previous task ending after another exercise starts', () => {
  speech.startSpeech({ owner: 'detail', exerciseId: '0043', steps: ['屈膝下蹲。'], lang: 'zh-CN' })
  const old = utterances.at(-1)
  speech.startSpeech({ owner: 'workout', exerciseId: '0029', steps: ['保持背部稳定。'], lang: 'zh-CN' })
  utterances.at(-1).onstart()
  old.onend()
  old.onerror({ error: 'interrupted' })
  expect(speech.getSpeechSnapshot()).toMatchObject({
    owner: 'workout', exerciseId: '0029', status: 'speaking', stepIndex: 0, error: null
  })
})
```

- [ ] Run: `npm test -- src/lib/exercise-speech.test.js`；确认新文件导入/新行为失败，再实现。
- [ ] 新任务、暂停、停止时先递增 generation，再 cancel；事件闭包只允许当前 generation 更新快照。每次仅创建一个步骤的 utterance，onend 后启动下一步，最后置 ended，绝不循环。
- [ ] 暂停保留步骤索引、文本、声音和 owner；cancel 后置 paused。继续重新创建该步骤的 utterance。代码注释明确 `ponytail: resume restarts the current instruction step; word-level resume is not portable.`
- [ ] `voice.lang` 规范化后按完整标签/主语言/default 顺序选择，仅接受本地声音；所有调用传实际 voice 和 lang。语速使用平台默认值，不添加音色/语速设置面板。
- [ ] 声音列表变化更新 voicesVersion；首次订阅读取 getVoices，最后一个订阅退出时解除监听。缺 API 安全返回 unsupported，不能在模块导入时访问不存在的 window。
- [ ] `not-allowed` 显示“请点击讲解重试”；音频硬件、busy、synthesis、language/voice-unavailable 错误显示失败或声音缺失。当前任务被系统意外 interrupted/canceled 也应结束，不长期停留 speaking；主动取消产生的旧事件由 generation 丢弃。禁止吞掉错误、无限重试或失败后换声音/语言。
- [ ] 运行定向测试。另用浏览器最小调用实际听到一条中文步骤并核对事件状态；仅测试模拟器通过不能称语音已可用。

### Task 3：共享控件和详情入口

**Files:** 新建 `components/ExerciseSpeech.jsx`、`components/ExerciseSpeech.test.jsx`；修改 `sheets.jsx`、全部现有 locale 文件。

**Interfaces:** 消费 instructionInfoFor/useLang 和 speech 模块；产生 `<ExerciseSpeech ex preview />`。

- [ ] 写 UI 行为测试，使用现有 React createRoot/act/happy-dom 风格：点击讲解后展示实际当前步骤，暂停/继续状态正确；同一动作两个入口切换所有权后，旧入口卸载不取消新任务；语言缺失时明确拒绝朗读而不是英文降级。
- [ ] Run: `npm test -- src/components/ExerciseSpeech.test.jsx`，先观察失败。
- [ ] 用 `useSyncExternalStore(subscribeSpeech, getSpeechSnapshot)` 订阅；`useLang()` 更新文字及来源判断；useId 作为 owner。只在用户按钮事件启动、暂停、继续、停止或重播，不在普通 mount effect 中启动。
- [ ] cleanup 调用 `stopSpeech(owner)`；exerciseId 或语言变化也停止自己拥有的任务。preview=true 完全不注册订阅与 cleanup；如需要分支组件，沿用 Media 的外层分派/内层 hooks 模式，避免条件 hooks。
- [ ] 当 snapshot.exerciseId 与入口动作相同，展示当前步骤及暂停/继续/停止按钮，显式用户操作将 snapshot.owner 传给控制器，因此自动任务也能被卡片暂停。重播以本入口 owner 重新启动；不同动作入口显示“讲解”。卸载 cleanup 始终仅停止本入口 owner，不能用 snapshot.owner，否则关闭旧弹层会误停新入口。按钮使用 type=button、可见文字、对应 aria-label 和现有样式，点击不冒泡到视频或动作卡导航。
- [ ] 在 ExerciseDetail 的 Media 后插入控件，保留底部文字列表。无 API/无声音/无当前语言步骤都保留位置并说明原因，而不是静默隐藏。
- [ ] 翻译新增键到所有现有 locale 文件。基础英文键至少包括：`Read instructions`、`Replay instructions`、`Stop narration`、`Instruction {0} / {1}`、`Speech is not supported on this device.`、`No local voice is available for this language. Check your device speech settings.`、`Instructions are not available in the current language.`、`Tap Read instructions to try again.`、`Could not play the instructions.`、`Resume restarts the current step.`。复用已有 Pause/Resume 文案。
- [ ] Run: `npm test -- src/components/ExerciseSpeech.test.jsx src/lib/i18n-core.test.js src/lib/exercise-speech.test.js`；并运行 `node scripts/check-locales.mjs`、`node scripts/check-source-strings.mjs`。
- [ ] 实际打开中文杠铃全蹲详情，首个媒体区后能看到按钮，点击后听见步骤；关闭详情时停止；视频保持自己的暂停/循环行为。

### Task 4：训练页手动入口、自动模式和全局停止

**Files:** 修改 `views/Workout.jsx`、`App.jsx`、locale 文件；新建 `views/Workout.speech.test.jsx`。

**Interfaces:** ExerciseBlock 增加 `preview=false`；ActiveWorkout 负责自动模式，不能让每张卡各自自动播报。

- [ ] 写基于真实 useStore/useUI 状态转换的测试：Cards/List/Compact 均可朗读，gifSize off 不隐藏控件；超级组不同时播两段；SwipeCards 预览不可启动和误停；结束会话/替换/删除动作停播；同 ID 的不同 entry 只自动读一次但手动重播可用；自动任务可由卡片暂停/继续。
- [ ] Run: `npm test -- src/views/Workout.speech.test.jsx`，确认行为尚不存在。
- [ ] 在 ExerciseBlock 标题下面加入控件，传入 preview；SwipeCards 的 renderPreview 两个 ExerciseBlock 分支显式传 preview。不要改媒体 props、组完成逻辑、进阶或历史数据。
- [ ] ActiveWorkout 增加本次自动模式布尔 state/ref，默认 false；标题区增加开关和“自动讲解仅在本次训练生效”的说明。旧设置 Sounds 只控制既有提示音，不控制用户主动点的讲解。
- [ ] 开关从关闭到开启时，在原始点击回调检查当前步骤及声音；本次尚未读过的动作同步 startSpeech，成功后才启用自动模式。已读过的动作只开启模式、不重播，用户可用“重播”主动再听。新页面/重新挂载从关闭开始；编辑历史训练和补录不启用自动模式。
- [ ] 自动 owner 使用 ActiveWorkout 的稳定 useId；记录本次已经自动读过的 exerciseId Set，成功提交后才记录。同 ID 的重复 entry 不再自动读，手动重播仍可用。关闭再开启自动模式不清空已读集合；重新进入训练页才重新创建集合。无需 entry 身份缓存、持久化 token 或新的训练数据字段。
- [ ] 只有真实 A.cur 的动作发生变化、自动模式开启、当前无弹层且页面前台时才启动；超级组由 A.cur 决定，不遍历组同时朗读。自动任务和手动入口仍有独立 owner，显式按钮允许控制当前同动作任务，卸载只清理自己的 owner。
- [ ] 普通动作/下一组导航先停上一段，再按自动规则决定是否播新动作；记录 sets、重量、计时器更新、视频循环、重复渲染不能触发讲解。替换/删除当前动作使旧朗读停止；重排不得造成无意义自动重播。
- [ ] 打开详情或其他弹层时停止训练朗读，暂停自动触发；关闭弹层不自动重播当前动作，下一次明确切换动作才允许自动播报。不得让弹层 cleanup 或后台卡片 cleanup 抢停另一个 owner。
- [ ] Shell 接入路由 key、用户所选语言及 langV 的停止 effect；切换语言的请求发生时先停，而不是等异步包加载后才停。监听 visibilitychange/pagehide，隐藏时全局 stop；页面回来不自动恢复。ActiveWorkout 同时关闭自动模式并在卸载/会话结束时释放任务。
- [ ] startSpeech 失败或当前任务出现播放错误时关闭本次自动模式并显示原因，不静默重试。用户必须重新点击开启。
- [ ] Run: `npm test -- src/views/Workout.speech.test.jsx src/views/Workout.test.jsx src/views/Workout.keys.test.jsx src/components/ExerciseSpeech.test.jsx src/lib/exercise-speech.test.js`。既有键盘训练逻辑必须把朗读按钮当交互元素，空格操作按钮时不能同时记录一个训练组。

### Task 5：端到端验收、说明和交付

**Files:** 功能通过 smoke 后更新 `docs/FAQ.md`、`docs/MOBILE.md`、`CHANGELOG.md`。

- [ ] 在 frontend 目录运行以下最终检查，实际记录结果，不预先标绿：

```bash
npm test -- src/lib/i18n-core.test.js src/lib/exercise-speech.test.js src/components/ExerciseSpeech.test.jsx src/views/Workout.speech.test.jsx src/components/Media.test.jsx src/components/Media.thumb.test.jsx src/lib/media-prefetch.test.js src/lib/sw-media.test.js src/views/Workout.keys.test.jsx
node scripts/check-locales.mjs
node scripts/check-source-strings.mjs
npm test
npm run build
```

- [ ] 全量测试之前已观察到 import-hevy、CoachChat.demo-failure、useStore.media 三个不相关失败，其中 media 用例存在同毫秒时序边界。不要重跑去“确认用户已报告的失败”，也不要顺手修复/删除它们。最终新一次全量回归单独报告当前失败与本改动是否有关，不能写“全部通过”。
- [ ] 运行实际应用，按 §4 矩阵操作并保存截图/日志；必须有人听到实际语音。自动化状态、录屏没有声音、fake SpeechSynthesis 都不是有声证明。
- [ ] 构建移动 web 资源时可用 `VITE_MOBILE=1 npm run build`；不要执行带 cap sync 的 build:mobile 覆盖用户现有原生改动。使用隔离副本进行原生设备测试，或记录明确缺失的设备/签名条件。
- [ ] 功能完成的网页验收必须通过；未实测的移动壳标为“未验证”，不能以浏览器兼容性推断为已支持。若目标壳缺 API，交付明确禁用提示及证据，不伪装成功，也不未经批准引入原生插件。
- [ ] FAQ 说明两个入口、暂停后从当前步骤继续、安装本地语音、自动模式仅本次有效；MOBILE 只写已测平台结果及后台停止限制；CHANGELOG 添加 Unreleased 项。
- [ ] 移除临时探针、关闭 browser tab/开发服务；最终报告修改文件、定向测试/构建结果、实际有声平台、未测平台和已知不相关回归。只提交已明确归属本功能的文件；用户没有要求时不推送、不合并。

## 4. 真实验收矩阵

| 场景 | 操作 | 必须观察到的结果 |
|---|---|---|
| 中文详情 | 打开 0043 杠铃全蹲，点击讲解 | 媒体下可见入口，听见中文步骤，顺序与文字一致 |
| 视频独立 | 听讲解时暂停/继续 MP4，并等待视频循环 | 不影响讲解，不因视频循环重复播报 |
| 暂停/继续 | 中途暂停，再继续 | 声音停止；继续从当前步骤开头读，不跳过安全提示 |
| 重播/切换 | 重播，然后改听另一个动作 | 从第一步重播；前一个立即停止，旧事件不把新任务标错 |
| 所有布局 | Cards、List、Compact、超级组、隐藏媒体 | 都能手动讲解；一次只听一段，无预览误触发 |
| 自动模式 | 初次进入、打开开关、切换动作、返回同动作 | 初次静音；打开后读当前动作；新动作一次；返回同 ID 不自动重读 |
| 生命周期 | 关闭详情、离开训练页、结束/替换/删除当前动作 | 不残留旧声音；界面状态恢复一致 |
| 弹层 | 自动模式中打开详情，手动读详情，再关闭 | 不与训练自动讲解叠音；关闭后不突然重播 |
| 无中文声音 | 用只提供英语/远程声音的可控环境 | 明确不可用，不发出英文/远程音频；出现本地中文声音后恢复可用 |
| 缺中文步骤 | 中文界面访问没有中文 pack 项的动作 | 提示当前语言无步骤，不把原英文用中文声音读 |
| 语言切换 | 中文朗读中改英语，并等待 pack 加载 | 中文立即停止；不自动启动英语；新点击读英文步骤 |
| 离线 | 先载入中文包，飞行模式点击讲解 | 本地声音确实可听；否则记录失败，不能宣称离线支持 |
| 后台/锁屏 | 朗读中切后台/锁屏再回来 | 停播，不自动恢复；不承诺锁屏收听 |
| 真实平台 | Chrome 桌面、Android Chrome、iOS Safari/PWA、目标 Capacitor 壳 | 分别记录 OS/浏览器/壳版本、声音名称/localService、是否实际听见；不把一个结果推广到其他平台 |
| 音乐/提示音 | 耳机播放音乐，触发讲解及休息结束提示音 | 记录是否打断/压低音乐、提示音是否仍可听；无新的全局 audioSession 副作用 |
| 中文内容质量 | 听深蹲、卧推、硬拉、推举、划船的现有步骤 | 术语可理解，顺序及安全提醒没有漏读；发现明显错误只修对应原步骤并记录，不全量改写 |

## 5. 完成标准与明确不做

完成条件：Task 1–5 代码、定向回归、网页真实有声 smoke 和用户文档完成；平台能力和未验证项如实列出。文字/视频既有行为不回退，无新增云依赖，无静默英文/远程降级，无自动外放和跨入口串音。

不做：预生成 MP3、付费 TTS、把音轨烧进 Vital 视频、原生后台音频插件、锁屏控制、逐字时间轴字幕、全量配音文案重写、语音聊天或计次数播报。只有用户要求锁屏/后台稳定讲解或统一音色时，再另行制定独立音频方案；本计划不留下这些功能的空实现。

## 6. API 依据

- [SpeechSynthesis：speak、cancel、getVoices、voiceschanged](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [SpeechSynthesisVoice.localService：本地/远程服务区分](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService)
- [SpeechSynthesisErrorEvent.error：not-allowed、interrupted、language-unavailable 等](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisErrorEvent/error)
