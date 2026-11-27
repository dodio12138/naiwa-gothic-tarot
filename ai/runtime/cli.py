"""单次解读：python3 ai/runtime/cli.py <牌阵> <牌:方向:位置> ... [--q 问题] [--say 用户说的话] [--model qwen3:4b] [--trace]
例：python3 ai/runtime/cli.py three major_16:r:past major_17:u:present major_18:u:future --q 分手以后我还能好起来吗
方向：u 正位，r 逆位。--trace 打印完整调试轨迹（检索、状态、动作、提示词）。"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from engine import run  # noqa: E402


def main(argv):
    if len(argv) < 2:
        print(__doc__)
        return
    spread, cards, q, says, model, trace = argv[0], [], '', [], 'qwen3:4b', False
    i = 1
    while i < len(argv):
        a = argv[i]
        if a == '--q':
            q = argv[i + 1]; i += 2
        elif a == '--say':
            says.append(argv[i + 1]); i += 2
        elif a == '--model':
            model = argv[i + 1]; i += 2
        elif a == '--trace':
            trace = True; i += 1
        else:
            cid, o, pos = a.split(':')
            cards.append({'card_id': cid, 'orientation': 'reversed' if o == 'r' else 'upright', 'position_id': pos})
            i += 1
    tr = run({'spread_id': spread, 'cards': cards, 'question': q, 'user_turns': says}, model=model)
    if trace:
        print(json.dumps(tr, ensure_ascii=False, indent=1))
    else:
        print(f"[{tr['action']}] {tr['action_reason']} · {tr['latency_s']}s\n")
        print(tr['output'])


if __name__ == '__main__':
    main(sys.argv[1:])
