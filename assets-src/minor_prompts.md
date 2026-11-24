# 56 张小阿卡纳 · 出图提示词

沿用 [Naiwa_Gothic_Tarot_Design.md](Naiwa_Gothic_Tarot_Design.md) 的角色锁定前缀（3.1）、风格后缀（3.2）、负面提示词（3.3）。
构图参考韦特牌的经典画面，但主角全部换成奶蛙；**避免十字架、教堂祭坛、宗教人物等明确宗教符号**（B 站审核敏感），用哥特建筑、星月、玫瑰代替。

ID：`<花色>_<序号>`，序号 01＝王牌，02–10＝数字牌，11 侍从，12 骑士，13 王后，14 国王。
导入：ChatGPT 下载的图命名为 `naiwa_art_<ID>*.png`，运行 `ID_PREFIX= assets-src/import_art.sh wands_01 …`。

## 出图模板

```text
[上传 naiwa_character_reference.png（身份参考）+ 一张已定稿牌面（风格参考）]
<3.1 角色锁定前缀>
Tarot minor arcana: <英文牌名>. Suit motif: <花色母题>. Scene: <单牌画面>.
<3.2 风格后缀，但把 "clean space reserved for a unified tarot border and titles" 换成：>
Full-bleed vertical 2:3 illustration that fills the entire canvas edge to edge, no border, no frame, no text, no numbers, no religious crosses.
```

## 花色母题

| 花色 | 元素 | 母题（写进提示词） |
|---|---|---|
| 权杖 Wands | 火 | living wooden staffs sprouting small green leaves, warm amber candle and ember light, crimson and burnt-orange accents, sunset gothic ruins |
| 圣杯 Cups | 水 | ornate silver-gold chalices, moonlit lakes and fountains, blue-violet mist, white lilies and water reflections |
| 宝剑 Swords | 风 | slender silver swords, cold wind, drifting feathers, storm-grey and steel-blue sky, high crags |
| 星币 Pentacles | 土 | large golden coins engraved with a five-pointed star, lush gothic gardens, vineyards and orchards, moss green and antique gold |

## 单牌画面

### 权杖 Wands
| ID | 牌 | 画面 |
|---|---|---|
| wands_01 | Ace of Wands | a small three-fingered yellow hand-like glow emerges from a cloud holding one sprouting wooden wand; below, Naiwa looks up from a hill toward a distant gothic castle at dawn |
| wands_02 | Two of Wands | Naiwa stands on a castle battlement holding a small globe, one wand fixed to the wall and one in hand, gazing over a sea at sunset |
| wands_03 | Three of Wands | seen from behind at a cliff edge, Naiwa stands among three planted wands watching small ships sail across a golden sea |
| wands_04 | Four of Wands | four flower-garlanded wands form a festive gate; Naiwa holds up bouquets in front of a warm-lit gothic manor |
| wands_05 | Five of Wands | five small Naiwas playfully cross and clack wooden wands in a mock tussle, no one hurt, dust and embers in the air |
| wands_06 | Six of Wands | Naiwa rides a white pony wearing a laurel wreath, holding a wand crowned with a wreath, small cheering silhouettes around |
| wands_07 | Seven of Wands | Naiwa stands on a rocky hilltop holding one wand defensively while six wands rise from below the ridge |
| wands_08 | Eight of Wands | eight wands fly in parallel diagonally across a clear sky over green hills; Naiwa watches from below, small and calm |
| wands_09 | Nine of Wands | a weary Naiwa with a small bandage leans on one wand in front of a fence of eight wands, still standing guard |
| wands_10 | Ten of Wands | Naiwa carries a heavy bundle of ten wands toward a distant village, belly pushing forward, steps slow |
| wands_11 | Page of Wands | Naiwa in a short feathered cap studies a sprouting wand in a desert of ruins, curious |
| wands_12 | Knight of Wands | Naiwa in light armor rides a rearing chestnut horse, wand raised, salamander motifs on the cape |
| wands_13 | Queen of Wands | Naiwa on a throne with lion carvings, holding a wand and a sunflower, a black cat at its feet |
| wands_14 | King of Wands | Naiwa on a throne carved with lions and salamanders, holding a blossoming wand, gazing into the distance |

### 圣杯 Cups
| ID | 牌 | 画面 |
|---|---|---|
| cups_01 | Ace of Cups | a glowing hand-like light from a cloud offers a chalice overflowing with five streams into a lotus pond; Naiwa sits at the pond edge |
| cups_02 | Two of Cups | two Naiwas face each other exchanging chalices under a winged-lion emblem of light |
| cups_03 | Three of Cups | three Naiwas raise chalices together in a harvest garden of grapes and pumpkins |
| cups_04 | Four of Cups | Naiwa sits under a tree with three cups before it, ignoring a fourth cup offered from a cloud |
| cups_05 | Five of Cups | Naiwa in a dark cloak looks down at three spilled cups, two upright cups behind it, a bridge to a castle beyond |
| cups_06 | Six of Cups | a small Naiwa hands a cup of white flowers to another Naiwa in a sunny old courtyard |
| cups_07 | Seven of Cups | Naiwa faces seven cups floating in clouds, each holding a dreamlike vision: a castle, jewels, a wreath, a dragon, a veiled shape, a serpent, a glowing head |
| cups_08 | Eight of Cups | Naiwa with a walking staff leaves eight stacked cups behind, walking toward moonlit mountains under an eclipse |
| cups_09 | Nine of Cups | a satisfied Naiwa sits before a curved table displaying nine cups |
| cups_10 | Ten of Cups | a family of Naiwas under a rainbow of ten cups, two small Naiwas dancing, a cottage by a river |
| cups_11 | Page of Cups | Naiwa holds a cup from which a small fish peeks out, by the seashore |
| cups_12 | Knight of Cups | Naiwa rides a calm white horse holding a cup forward, wings on its helmet, a gentle river crossing |
| cups_13 | Queen of Cups | Naiwa on a shell-carved throne at the shore, gazing into an ornate lidded chalice |
| cups_14 | King of Cups | Naiwa on a throne floating on a stormy sea, holding a cup and a short sceptre, a fish leaping nearby |

### 宝剑 Swords
| ID | 牌 | 画面 |
|---|---|---|
| swords_01 | Ace of Swords | a glowing hand-like light from a cloud grips an upright sword crowned with a wreath above rocky peaks; Naiwa looks up |
| swords_02 | Two of Swords | Naiwa sits by a moonlit shore with two swords crossed over its chest, eyes closed calmly (eyes still visible as closed lids) |
| swords_03 | Three of Swords | a large stylized heart pierced by three swords floats in a rain cloud; Naiwa holds a small umbrella beneath it, no blood |
| swords_04 | Four of Swords | Naiwa sleeps peacefully on a stone bench in a quiet vaulted hall, three swords on the wall and one beneath the bench |
| swords_05 | Five of Swords | Naiwa gathers three swords on a windy shore while two small figures walk away, two swords on the ground |
| swords_06 | Six of Swords | Naiwa ferries a small cloaked companion across calm water in a boat with six upright swords, toward a distant shore |
| swords_07 | Seven of Swords | Naiwa tiptoes away from a festive camp carrying five swords, two left planted behind |
| swords_08 | Eight of Swords | Naiwa stands loosely wrapped in a ribbon among eight swords on wet ground, the ribbon clearly loose, a castle on a hill |
| swords_09 | Nine of Swords | Naiwa sits up in bed at night, short hands on its face, nine swords hanging on the dark wall behind |
| swords_10 | Ten of Swords | Naiwa lies flat face-down on a shore with ten swords stuck in the ground around it (not into its body), dawn breaking over dark water |
| swords_11 | Page of Swords | Naiwa stands on a windy hill holding a sword upright, watching the sky alertly |
| swords_12 | Knight of Swords | Naiwa charges forward on a galloping white horse, sword raised, clouds torn by the wind |
| swords_13 | Queen of Swords | Naiwa on a stone throne with butterfly carvings holds a sword upright and raises one hand, clouds below |
| swords_14 | King of Swords | Naiwa on a high throne faces forward holding a sword upright, butterflies and crescent moons on the throne |

### 星币 Pentacles
| ID | 牌 | 画面 |
|---|---|---|
| pentacles_01 | Ace of Pentacles | a glowing hand-like light from a cloud holds a large golden star-coin above a lush garden archway; Naiwa stands at the garden path |
| pentacles_02 | Two of Pentacles | Naiwa juggles two star-coins linked by an infinity ribbon, ships riding high waves behind |
| pentacles_03 | Three of Pentacles | Naiwa the stonemason works on a gothic garden arch while two hooded figures hold plans |
| pentacles_04 | Four of Pentacles | Naiwa sits hugging one star-coin, one on its head, two under its feet, a city behind |
| pentacles_05 | Five of Pentacles | two Naiwas in tattered cloaks walk through snow past a glowing stained-glass window with five coins |
| pentacles_06 | Six of Pentacles | Naiwa holds a balance scale and gives coins to two smaller Naiwas kneeling |
| pentacles_07 | Seven of Pentacles | Naiwa leans on a hoe looking at seven star-coins growing on a leafy bush |
| pentacles_08 | Eight of Pentacles | Naiwa carves a star-coin at a workbench, more finished coins displayed on a post |
| pentacles_09 | Nine of Pentacles | Naiwa stands in a vineyard with a hooded falcon on its hand, nine coins among the vines |
| pentacles_10 | Ten of Pentacles | three generations of Naiwas and two white dogs beneath an archway decorated with ten star-coins |
| pentacles_11 | Page of Pentacles | Naiwa holds up a star-coin and studies it in a blooming meadow |
| pentacles_12 | Knight of Pentacles | Naiwa sits on a heavy black horse standing still, holding a star-coin, ploughed fields behind |
| pentacles_13 | Queen of Pentacles | Naiwa on a throne in a flowering garden cradles a star-coin, a rabbit nearby |
| pentacles_14 | King of Pentacles | Naiwa on a throne carved with bull heads, robe embroidered with grapes, holding a star-coin and sceptre |
