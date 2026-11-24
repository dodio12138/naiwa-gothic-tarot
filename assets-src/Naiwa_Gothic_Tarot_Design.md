# 奶蛙的暗黑命运｜Naiwa Gothic Tarot

> 暗黑哥特 × 奶蛙原创角色 × 经典塔罗象征主义  
> 版本：1.0｜日期：2026-11-24  
> 用途：22 张大阿尔卡那美术设定、AI 绘图提示词、批量生成规范

## 0. 项目定位

本项目以用户提供的**「奶蛙」三视图角色设定**为唯一角色造型基准，重新演绎韦特塔罗体系的 22 张大阿尔卡那。视觉反差是整个系列的核心：**角色保持明亮黄色、呆萌而沉静；环境、服装、装饰、道具呈现暗黑哥特与神秘命运感**。

**重要纠偏**：“奶蛙”不是人类婴儿、普通青蛙或哥特洋娃娃。不要把之前方案的 `baby / infant / porcelain doll / chibi child` 当作主体身份关键词。

### 风格一句话

> 一只始终面无表情的黄色梨形奶蛙，穿行于庄严、阴郁、华丽的哥特塔罗世界。

## 1. 奶蛙角色识别规范（不可改变）

依据用户上传的角色三视图：

| 类别 | 固定特征 | 不允许的偏离 |
|---|---|---|
| 整体轮廓 | 黄色、近梨形、无明显脖颈；头和躯干一体，腹部非常圆大 | 改成人类身体、普通蛙类体型、瘦长比例 |
| 头脸 | 头顶圆滑，与身体连续过渡 | 加人类头发、尖下巴、鼻梁或人类耳朵 |
| 眼睛 | 左右两只突出圆眼，绿色虹膜、黑色瞳孔 | 改为人类大眼、红眼或眼罩长期遮盖 |
| 嘴巴 | 极简短横线，呆滞、沉默 | 大笑、尖牙、夸张嘴唇或复杂表情 |
| 手臂手掌 | 短而贴近身体；手部三指 | 五指、过长手臂、人类手掌 |
| 腿和脚 | 短腿、宽脚掌，脚部三趾 | 长腿、高跟鞋、明显人类脚掌 |
| 颜色 | 主体明亮黄色，腹部较浅；眼周带绿色，瞳孔黑色 | 整体改成灰白、黑色、紫色 |
| 表面 | 柔软平滑、哑光 3D 卡通质感 | 毛绒、鳞片、写实皮肤、瓷娃娃裂纹 |
| 气质 | 呆萌、安静、沉稳、近乎无表情 | 夸张恐怖或戏剧性面部表演 |

**服装原则**：可以披斗篷、戴冠冕、持道具、穿披肩或仪式袍，但必须留出圆腹、眼睛和三指/三趾等识别点。服装应“附着在奶蛙身上”，不能把奶蛙改造成服装所暗示的人类角色。

### 角色参考图接入

1. 每次生成时上传用户提供的三视图，标注“此图只用于锁定主角外观，不要复制白底设定图的排版”。
2. 有角色参考权重的模型优先启用图像/角色参考；支持多参考图时，以原始三视图为**身份参考**，已定稿的塔罗图为**风格参考**。
3. 对遮挡严重的场景，特别强调眼睛、腹部轮廓和手脚应可见。
4. 不同平台参数差异很大，具体权重以所使用模型的当前功能为准；不要把某个平台的参数直接套到另一平台。

## 2. 统一视觉美术规范

### 2.1 美术方向

- **主角**：保留原始哑光 3D 玩偶式表面，不改画成儿童、萌系拟人角色。
- **环境**：哥特教堂、尖拱、古堡、墓园、月下湖泊、荆棘、烛火、花窗、古典祭坛。
- **情绪**：庄严、静谧、神秘、克制，允许轻度荒诞反差；不追求血腥与跳吓。
- **画面风格**：3D 角色与绘画质感背景融合，柔和电影布光；不强求写实照片质感。
- **象征**：各牌必须保留其关键传统符号，避免只换服装而失去塔罗辨识度。

### 2.2 推荐色板

| 用途 | 颜色 | HEX |
|---|---|---|
| 奶蛙主体黄 | 鲜黄 | `#F6D94F` |
| 奶蛙腹部 | 浅黄 | `#F9E77F` |
| 奶蛙虹膜 | 橄榄绿 | `#8AA94E` |
| 奶蛙瞳孔 | 近黑 | `#282826` |
| 哥特背景底色 | 炭黑紫 | `#17141F` |
| 酒红点缀 | 暗玫红 | `#45203A` |
| 冷银灰 | 石板银 | `#777187` |
| 边框古金 | 哑光古金 | `#B39963` |

以黄色角色为**视觉锚点**，单卡的其他颜色按象征意义调整。禁止用强烈紫光将角色的黄色完全染掉。

### 2.3 固定牌面结构

- 画幅比例：**7:12**；建议先以高分辨率无字竖画生成。
- 顶部区域：牌序数字（愚者为 `0`，其余为罗马数字 `I–XXI`）。
- 中央区域：奶蛙 + 每张牌 2–4 个关键象征符号。
- 四周：统一暗金哥特尖拱、荆棘纹样和小型星月纹章边框。
- 底部区域：英文牌名居中，统一古典衬线字体。
- **排版工作流**：先生成不含文字的中心插画，再在设计软件中统一添加编号、牌名和边框；比让生成模型直接输出准确文字更稳定。
- 建议物理印刷尺寸：70 × 120 mm，另加 3 mm 出血；实际由印厂模板确认。

## 3. AI 绘图总提示词

### 3.1 角色锁定前缀（英文）

```text
Use the uploaded Naiwa character turnaround sheet as the strict identity reference for the main subject. Naiwa is an original bright-yellow pear-shaped creature with a huge round belly, seamless head and torso without a visible neck, protruding round eyes with green irises and black pupils, a tiny straight horizontal mouth, short rounded arms, three-fingered hands, short legs, and three-toed feet. Preserve the exact original proportions, simple deadpan expression, vivid yellow color and smooth matte 3D appearance. This is NOT a human baby, humanoid child, ordinary frog, porcelain doll, or generic chibi character. Only vary the costume, pose, props, and setting required by the tarot card; keep the underlying mascot identity unchanged.
```

### 3.2 全套风格后缀（英文）

```text
Premium dark gothic tarot card illustration, the bright yellow Naiwa mascot contrasted against a solemn mysterious gothic environment, ancient cathedral architecture, black roses, elegant thorns, moonlit mist, ornate antique-gold filigree, dark burgundy and midnight-blue shadows, cinematic candlelight and moonlight, detailed yet controlled symbolism, painterly atmospheric background blended with faithful matte 3D character rendering, refined collectible deck aesthetic, centered vertical 7:12 composition, clean space reserved for a unified tarot border and titles, no embedded text.
```

### 3.3 通用负面提示词（英文）

```text
human baby, human child, human face, conventional frog anatomy, frog snout, realistic amphibian skin, long limbs, skinny waist, five fingers, five toes, hair, human ears, exaggerated smile, exposed teeth, changed eye color, changed body color, mascot redesign, plush fur, cracked porcelain, neon cyberpunk, contemporary streetwear, generic anime, cheap plastic gloss, gore, violent injuries, sexualized character, cluttered layout, illegible letters, watermark, duplicate limbs, extra fingers, inconsistent border
```

### 3.4 推荐拼接方式

```text
[上传角色参考图]
+ [3.1 角色锁定前缀]
+ [对应牌面专属提示词]
+ [3.2 全套风格后缀]
+ [3.3 负面提示词（若平台支持）]
```

**提示**：下面每一张牌的提示词只写其**专属差异内容**，需要与通用前后缀一起使用。

---

## 4. 22 张大阿尔卡那专属提示词

### 00｜愚者 THE FOOL

- **核心含义**：开始、纯真、未知冒险。
- **核心视觉**：悬崖、小旅行包、黑狗、黑玫瑰。
- **动作设计**：奶蛙呆呆地站在悬崖前，微微抬脚，手拿小包袱。仍保持短手短脚和一字嘴。
- **主色**：冷白、黑、古金。

```text
Tarot archetype: THE FOOL, card 0. Naiwa stands innocently near the edge of a moonlit cliff, carrying a tiny travel bundle on a short stick; a small black dog gently approaches its feet. A single black rose grows beside the path. Far behind are gothic mountains and a ruined castle under a pale moon. Preserve Naiwa's unchanging blank expression and huge yellow belly. The imagery conveys innocence, beginnings and stepping into the unknown. No text inside the artwork.
```

### I｜魔术师 THE MAGICIAN

- **核心含义**：意志、创造、行动。
- **核心视觉**：祭坛、权杖、圣杯、宝剑、星币、无限符号。
- **动作设计**：奶蛙一只短手举魔杖，另一只指向祭坛。
- **主色**：酒红、暗金、墨黑。

```text
Tarot archetype: THE MAGICIAN, card I. Naiwa stands behind a narrow gothic stone altar, raising a small wand with one short three-fingered hand while lowering the other toward the ground. On the altar are four clearly distinct ritual objects: a wand, a chalice, a sword and a pentacle coin. A delicate glowing infinity symbol appears over Naiwa's head. Black roses and ivory lilies frame the altar, with dramatic red stained-glass light behind. Keep its round yellow belly and calm horizontal mouth visible. Symbolism of focused will and creation. No text inside the artwork.
```

### II｜女祭司 THE HIGH PRIESTESS

- **核心含义**：直觉、隐秘、潜意识。
- **核心视觉**：黑白双柱、卷轴、月冠、石榴帷幕。
- **动作设计**：奶蛙坐在低矮石座，怀里放着古卷，双眼直视前方。
- **主色**：深蓝、银灰、黑紫。

```text
Tarot archetype: THE HIGH PRIESTESS, card II. Naiwa sits on a broad low gothic throne between one black pillar and one white pillar. A small crescent-moon head ornament rests above its protruding eyes without obscuring them. An ancient scroll lies against its huge round belly. Behind is a velvet curtain patterned with pomegranates, and a silver crescent moon glows near the feet. Silent cathedral moonlight, still water and hidden sacred knowledge. Keep the mascot's pear-shaped yellow silhouette clearly recognizable. No text inside the artwork.
```

### III｜皇后 THE EMPRESS

- **核心含义**：丰饶、养育、生命。
- **核心视觉**：花园、麦穗、石榴、金星徽记。
- **动作设计**：奶蛙靠在宽大的丝绒宝座上，肚子自然鼓起。
- **主色**：枯玫瑰红、暗绿、旧金。

```text
Tarot archetype: THE EMPRESS, card III. Naiwa sits in a luxurious velvet throne in an enchanted gothic garden, wearing a light embroidered cape and a delicate crown with twelve tiny stars. The enormous yellow belly remains unobstructed. Dark roses, ripe pomegranates, golden wheat, and ivy surround the throne. A small shield marked with the Venus symbol rests at one side. A warm but restrained golden beam touches the mascot against a somber woodland background. Abundance, gentle nurturing and growth. No text inside the artwork.
```

### IV｜皇帝 THE EMPEROR

- **核心含义**：秩序、结构、权威。
- **核心视觉**：黑曜石王座、公羊头、权杖、金球、岩山。
- **动作设计**：奶蛙端坐王座，披风在肚子两侧自然下垂。
- **主色**：猩红、黑曜石、古金。

```text
Tarot archetype: THE EMPEROR, card IV. Naiwa sits very seriously on an oversized black obsidian throne ornamented with four carved ram heads. A miniature red velvet imperial cape drapes beside, not over, its large belly. One short hand holds a tiny scepter and the other a gold orb. Bare monumental rock mountains rise under a dark crimson sky. The visual contrast between a small expressionless yellow mascot and severe imperial architecture is deliberate. Authority, structure and responsibility. No text inside the artwork.
```

### V｜教皇 THE HIEROPHANT

- **核心含义**：传统、仪式、教导。
- **核心视觉**：圣堂、三重冠、两把交叉钥匙、仪式侍者。
- **动作设计**：奶蛙披祭袍，举起短手祝福；可用两只小型影子侍者作为陪衬。
- **主色**：深红、象牙白、金。

```text
Tarot archetype: THE HIEROPHANT, card V. Naiwa sits between two massive cathedral pillars wearing a ceremonial crimson mantle and a tiny three-tiered gold headdress specially fitted around the protruding eyes. One short three-fingered hand rises in a simple blessing gesture. Two crossed antique keys lie clearly visible on the floor, and two miniature hooded acolyte silhouettes kneel before the throne. Incense, candles and deep stained-glass illumination create a solemn ritual atmosphere. Tradition, spiritual teaching and inherited wisdom. No text inside the artwork.
```

### VI｜恋人 THE LOVERS

- **核心含义**：联结、信任、抉择。
- **核心视觉**：两只奶蛙、双树、天使、岔路。
- **动作设计**：两个外形一致的奶蛙站在两条路径交汇处，短手轻轻相触；不拟人化。
- **主色**：暗玫红、灰紫、月金。

```text
Tarot archetype: THE LOVERS, card VI. Two Naiwa mascots with exactly the same original yellow pear-shaped anatomy stand side by side at a forked path in a gothic garden, lightly touching their small three-fingered hands. One tree bears dark roses, the other mysterious red fruit with a subtle serpent. A luminous winged angel appears high above them. Both mascots retain their blank horizontal mouths and round protruding green eyes, with no human anatomy or romanticized styling. Trust, connection and a meaningful choice. No text inside the artwork.
```

### VII｜战车 THE CHARIOT

- **核心含义**：驾驭、意志、胜利。
- **核心视觉**：战车、黑白狮身人面兽、星空帷幕、城门。
- **动作设计**：奶蛙站在车厢中，肚子露出车沿，短手握小权杖。
- **主色**：黑银、皇家蓝、冷白。

```text
Tarot archetype: THE CHARIOT, card VII. Naiwa stands inside a small but elaborately decorated gothic chariot under a silver-star canopy. Its huge yellow belly protrudes gently above the chariot edge, and its short hand holds a tiny command staff. Two calm sphinxes, one black and one white, sit in front facing slightly different directions. A distant medieval city gate and stormy blue sky create dramatic depth. Keep the mascot's original three-toed feet visible where possible. Discipline, willpower and control over opposing forces. No text inside the artwork.
```

### VIII｜力量 STRENGTH

- **核心含义**：温柔、勇敢、自我掌控。
- **核心视觉**：巨大黑狮、无限符号、黑玫瑰。
- **动作设计**：奶蛙用三指小手轻轻摸黑狮鬃毛，狮子低头。
- **主色**：暖黄、暗黑、柔金。

```text
Tarot archetype: STRENGTH, card VIII. Naiwa stands calmly in a moonlit rose garden, gently resting a tiny three-fingered hand against the mane of an enormous peaceful black lion. The lion bows its head in trust, with no threat or aggression. A subtle golden infinity symbol floats above Naiwa's familiar protruding green eyes. The character remains vivid yellow with its unchanged round belly and expressionless mouth. A poetic contrast between apparent weakness and quiet courage; compassion instead of force. No text inside the artwork.
```

### IX｜隐者 THE HERMIT

- **核心含义**：内省、探索、智慧。
- **核心视觉**：雪山、斗篷、星光提灯、手杖。
- **动作设计**：奶蛙身披不遮脸的黑灰短披肩，举灯独行。
- **主色**：石灰、银白、黑。

```text
Tarot archetype: THE HERMIT, card IX. Naiwa stands alone on a narrow snowy mountain ridge wearing a short charcoal cloak that leaves the yellow face, round belly and feet clearly visible. One small hand holds an antique lantern containing a radiant six-pointed star, while the other carries a walking staff. Snow falls slowly into the black night. The little yellow creature maintains its still, inscrutable expression amid an immense landscape. Solitude, contemplation and inner guidance. No text inside the artwork.
```

### X｜命运之轮 WHEEL OF FORTUNE

- **核心含义**：循环、变化、命运。
- **核心视觉**：古金巨轮、炼金字符、狮身人面兽、四角翼兽。
- **动作设计**：奶蛙站在轮盘底座仰望，上半身与大腹部清晰。
- **主色**：古铜金、深紫、午夜蓝。

```text
Tarot archetype: WHEEL OF FORTUNE, card X. Naiwa stands beneath a gigantic antique golden wheel floating in a cosmic gothic sky, looking upward with its usual wide green eyes and flat mouth. The wheel carries alchemical markings and intricate clockwork. A sphinx sits on top, a serpent descends beside it and a jackal-like figure rises on the other side. Four winged symbols occupy the corners: angel, eagle, lion and bull. The tiny bright-yellow mascot offers a stable visual anchor within the elaborate scene. Cycles, chance and changing destiny. No text inside the artwork.
```

### XI｜正义 JUSTICE

- **核心含义**：平衡、因果、公正。
- **核心视觉**：天平、直剑、石座、深红帷幕。
- **动作设计**：奶蛙坐于石座，一只小手持剑，另一只小手持天平。
- **主色**：酒红、金、煤黑。

```text
Tarot archetype: JUSTICE, card XI. Naiwa sits in a symmetrical gothic stone seat between two dark pillars. A tailored crimson ceremonial shoulder cape frames but does not conceal its oversized yellow belly. It holds an upright silver sword in one three-fingered hand and balanced gold scales in the other. A heavy burgundy curtain hangs behind. Strong frontal alignment, calm green eyes, perfectly straight mouth. Truth, balance, consequences and impartial judgment. No text inside the artwork.
```

### XII｜倒吊人 THE HANGED MAN

- **核心含义**：等待、换位思考、顿悟。
- **核心视觉**：T 形古树、倒悬姿态、金色光环、藤蔓。
- **动作设计**：奶蛙以奇幻魔法安全倒悬，不出现勒痕和伤害，身体比例不变。
- **主色**：墨绿、青灰、柔金。

```text
Tarot archetype: THE HANGED MAN, card XII. Naiwa floats safely upside down beneath a T-shaped living tree in an enchanted gothic forest, held gently by a glowing magical ribbon around one ankle. Its yellow pear-shaped torso and large belly remain anatomically unchanged, with the same round green eyes and tiny straight mouth. One short leg is bent, its little arms resting calmly. A golden halo glows behind its head. The mood is serene and contemplative, with no injury or distress. Pause, surrender and new perspective. No text inside the artwork.
```

### XIII｜死神 DEATH

- **核心含义**：终结、转化、新生。
- **核心视觉**：黑旗上的白玫瑰、白马、凋落花园、双塔晨光。
- **动作设计**：奶蛙披黑色短斗篷骑小白马，脸与肚子显露。
- **主色**：黑、骨白、暗红。

```text
Tarot archetype: DEATH, card XIII. Naiwa rides a gentle small white horse through an abandoned moonlit rose garden, wearing a black hooded cape fitted to its pear-shaped body without covering its protruding green eyes. One short hand carries a tall black banner marked with a single luminous white rose. Fallen crowns and scattered petals lie peacefully on the path. A faint sunrise emerges between two distant gothic towers. No skeleton face, wounds or gore; Naiwa stays unmistakably yellow and deadpan. Endings, transformation and rebirth. No text inside the artwork.
```

### XIV｜节制 TEMPERANCE

- **核心含义**：调和、节制、平衡。
- **核心视觉**：两只杯、星光水流、一脚入水、一脚踏岸、远山日光。
- **动作设计**：奶蛙背上可增加小型灰白羽翼，但不可改变身体形状。
- **主色**：银蓝、雾白、香槟金。

```text
Tarot archetype: TEMPERANCE, card XIV. Naiwa stands by a moonlit pool, with one three-toed foot touching the water and the other on a stone bank. Tiny gray-white feathered wings are attached behind its original yellow pear-shaped body. Using its short three-fingered hands, Naiwa gently pours a glowing silver stream between two antique chalices. A narrow road leads toward distant mountains and a rising pale sun. The mascot remains round, simple-faced and recognizably unchanged. Harmony, healing and moderation. No text inside the artwork.
```

### XV｜恶魔 THE DEVIL

- **核心含义**：诱惑、执念、自我束缚。
- **核心视觉**：黑石台、小角、小蝠翼、倒置火炬、松动锁链。
- **动作设计**：奶蛙加可拆卸小角与翅膀，不改嘴型和眼睛。
- **主色**：黑紫、深红、铜金。

```text
Tarot archetype: THE DEVIL, card XV. Naiwa sits on a black obsidian pedestal with two tiny decorative horns and small bat wings attached as costume elements. Its original yellow belly, protruding green eyes, short arms and flat mouth are fully preserved. One three-fingered hand holds a downward-pointing ceremonial torch. Below the pedestal are two miniature shadow figures with clearly loose, removable chains. Black roses and crimson candles stand in the ruined chapel. A slightly absurd but solemn contrast between the mascot's innocence and gothic temptation. Attachment, illusion and self-imposed bondage. No text inside the artwork.
```

### XVI｜高塔 THE TOWER

- **核心含义**：崩塌、惊醒、突变。
- **核心视觉**：闪电、裂开的尖塔、坠落王冠、发光碎片。
- **动作设计**：奶蛙在塔前安全的石阶上仰望塔楼，不让角色坠落或受伤。
- **主色**：黑蓝、闪电金、暗橙。

```text
Tarot archetype: THE TOWER, card XVI. Naiwa stands safely on a distant stone stairway, gazing upward with its unchanged blank expression as lightning strikes a giant gothic tower. The ornamental gold crown of the tower breaks free; sparkling architectural fragments scatter through an indigo storm cloud. Two small abstract luminous spirit shapes drift harmlessly away from the tower, clearly not injured characters. The bright-yellow mascot stands in the calm foreground, contrasting with the dramatic upheaval behind. Sudden revelation and collapse of false certainty. No text inside the artwork.
```

### XVII｜星星 THE STAR

- **核心含义**：希望、疗愈、灵感。
- **核心视觉**：八芒大星、七颗小星、两只水罐、池塘。
- **动作设计**：奶蛙站在池边，短手分别持罐，倾倒发光星水。
- **主色**：星银、夜蓝、淡紫。

```text
Tarot archetype: THE STAR, card XVII. Naiwa stands beside a mirror-like midnight pond, holding two small silver pitchers with its short three-fingered hands. One pitcher pours shimmering starlight into the pond, and the other waters a bed of black roses. Above shines one brilliant eight-pointed silver star surrounded by seven smaller stars. Distant trees and a small black bird create a serene gothic landscape. The yellow mascot's oversized belly and green eyes remain the focus. Quiet hope, restoration and inspiration. No text inside the artwork.
```

### XVIII｜月亮 THE MOON

- **核心含义**：潜意识、迷惘、直觉。
- **核心视觉**：两座高塔、月亮、黑狗与白狼、池中龙虾、弯曲道路。
- **动作设计**：奶蛙抱一只黑兔玩偶站在月下小径中，保持呆萌无表情。
- **主色**：月银、深紫、蓝黑。

```text
Tarot archetype: THE MOON, card XVIII. Naiwa stands on a winding path between two ancient gothic towers, holding a tiny black rabbit plush toy with its short arms. A calm black dog and pale wolf stand on opposite sides of the path. A small crayfish emerges from the moonlit reflective pool in the foreground. An immense pale moon hangs above through violet mist. The toy does not hide Naiwa's giant round yellow belly or green protruding eyes. Dream imagery, uncertainty, subconscious fears and intuition. No text inside the artwork.
```

### XIX｜太阳 THE SUN

- **核心含义**：快乐、清明、活力。
- **核心视觉**：苍金太阳、白马、红旗、向日葵与矮石墙。
- **动作设计**：奶蛙骑小白马，短手握红旗；无须强迫笑脸。
- **主色**：苍金、暖白、酒红。

```text
Tarot archetype: THE SUN, card XIX. Naiwa rides a gentle small white pony past a low garden wall, wearing a short crimson cape while holding a red banner in one tiny three-fingered hand. Huge dark sunflowers rise behind the wall. An enormous warm antique-gold sun with a subtle serene face illuminates the gothic garden. Naiwa remains bright yellow, round-bellied and expressionless; the joyful atmosphere is carried by composition and light rather than facial redesign. Clarity, happiness and renewal. No text inside the artwork.
```

### XX｜审判 JUDGEMENT

- **核心含义**：觉醒、呼唤、重生。
- **核心视觉**：金色号角、白底红十字旗、石棺、灵光。
- **动作设计**：奶蛙在云端吹号角，嘴部仍保持简化造型；下方为非写实抽象光灵。
- **主色**：冷白、金、灰蓝。

```text
Tarot archetype: JUDGEMENT, card XX. Naiwa stands on a small luminous cloud platform, wearing ornamental black-and-white feathered wings while holding a long golden trumpet near its tiny straight mouth. A small white banner with a red cross hangs from the trumpet. Beneath the clouds, ancient sarcophagi open peacefully and abstract tiny glowing spirit silhouettes rise in beams of soft light. Silver mountains and distant cathedral spires fill the background. Keep Naiwa's original pear-shaped yellow body and green eyes. Awakening, calling and renewal, no horror or injuries. No text inside the artwork.
```

### XXI｜世界 THE WORLD

- **核心含义**：完成、统一、圆满。
- **核心视觉**：椭圆月桂花环、两支短杖、四角天使/鹰/狮/牛。
- **动作设计**：奶蛙悬浮在花环内，两只短手各持一支礼杖，保持原有比例。
- **主色**：暗金、墨绿、紫罗兰。

```text
Tarot archetype: THE WORLD, card XXI. Naiwa floats weightlessly at the exact center of a grand oval wreath made of dark laurel leaves, black roses and antique-gold ribbons. Its smooth yellow pear-shaped silhouette, huge belly, protruding green eyes, tiny horizontal mouth and short limbs are completely unchanged. One tiny ceremonial wand is held in each three-fingered hand. Four celestial emblems occupy the corners: angel, eagle, lion and bull. A deep purple cosmic sky with soft golden stars forms the background. Wholeness, completion and cosmic unity. No text inside the artwork.
```

---

## 5. AI 图像生成与批量制作流程

### 阶段 A｜锁定主角

1. 以用户的奶蛙三视图为身份参考，先生成**无塔罗服装的基础角色测试图**。
2. 核对 8 个识别点：亮黄、梨形、圆腹、无脖、绿眼、一字嘴、三指、三趾。
3. 不通过就修改提示词或提高参考约束，**不要开始批量出牌**。

### 阶段 B｜锁定美术风格

1. 先做 `THE FOOL`、`THE HIGH PRIESTESS`、`DEATH`、`THE MOON`、`THE DEVIL` 五张。
2. 比较边框空间、角色所占面积、光照、阴暗程度和符号准确性。
3. 选择一张作为风格参考，与原始三视图同时用于后续牌面。

### 阶段 C｜统一制图

1. 每张牌：三视图 + 角色锁定前缀 + 单牌提示词 + 风格后缀。
2. 优先生成**无文字、无固定边框**插画。
3. 构图中保留上下标题安全区，主角不得被裁切。
4. 单独在 Photoshop、Illustrator、Figma、InDesign 等工具中叠加统一边框、牌号与牌名。
5. 输出时按印厂要求转换为印刷色彩空间并检查出血、分辨率和黑色细节。

### 阶段 D｜质量控制检查单

- [ ] 主角是否明显是上传的奶蛙，而不是婴儿/普通青蛙？
- [ ] 大圆腹、无脖梨形轮廓是否存在？
- [ ] 双眼是否为绿色虹膜、黑色瞳孔？
- [ ] 嘴是否保持短横线？
- [ ] 手脚是否保持三指/三趾（若可见）？
- [ ] 黄色是否被光影严重改色？
- [ ] 服饰是否避开了关键识别部位？
- [ ] 对应传统牌面的关键象征是否完整？
- [ ] 环境是否属于统一的暗黑哥特世界？
- [ ] 边框、字体、编号、标题是否统一且正确？

## 6. 文件命名与资产组织

```text
Naiwa_Gothic_Tarot/
├── references/
│   ├── naiwa_turnaround.png       # 用户提供的角色三视图（应复制原图）
│   └── approved_style.png         # 经确认的风格参考
├── prompts/
│   └── Naiwa_Gothic_Tarot_Design.md
├── illustrations/
│   ├── 00_THE_FOOL.png
│   ├── 01_THE_MAGICIAN.png
│   ├── ...
│   └── 21_THE_WORLD.png
├── overlays/
│   ├── tarot_border.png
│   └── typography_template.*
└── exports/
    ├── print/
    └── preview/
```

## 7. 22 张牌编号总表

| 编号 | 英文 | 中文 |
|---:|---|---|
| 0 | THE FOOL | 愚者 |
| I | THE MAGICIAN | 魔术师 |
| II | THE HIGH PRIESTESS | 女祭司 |
| III | THE EMPRESS | 皇后 |
| IV | THE EMPEROR | 皇帝 |
| V | THE HIEROPHANT | 教皇 |
| VI | THE LOVERS | 恋人 |
| VII | THE CHARIOT | 战车 |
| VIII | STRENGTH | 力量 |
| IX | THE HERMIT | 隐者 |
| X | WHEEL OF FORTUNE | 命运之轮 |
| XI | JUSTICE | 正义 |
| XII | THE HANGED MAN | 倒吊人 |
| XIII | DEATH | 死神 |
| XIV | TEMPERANCE | 节制 |
| XV | THE DEVIL | 恶魔 |
| XVI | THE TOWER | 高塔 |
| XVII | THE STAR | 星星 |
| XVIII | THE MOON | 月亮 |
| XIX | THE SUN | 太阳 |
| XX | JUDGEMENT | 审判 |
| XXI | THE WORLD | 世界 |

---

**最终设计准则**：**奶蛙不需要变得黑暗；让它以始终不变的黄色、圆肚子和呆滞表情，置身黑暗的命运世界。**
