#!/usr/bin/env python3
"""Render public-profile targets from the canonical presence and site inventory.

No network, authentication, profile saves or publication. Run after editing the
canonical source, then build/check the site and apply only authorized fields.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def outputs(presence, content):
    paragraphs = presence['identity']['about_paragraphs']
    if len(paragraphs) != 4 or any(not isinstance(s, str) or not 1 <= len(s) <= 400 for s in paragraphs):
        raise ValueError('Shared biography needs four short paragraphs')
    projects = presence['identity']['featured_work']
    if not projects or any(not p['url'].startswith('https://') for p in projects):
        raise ValueError('Featured work needs public HTTPS links')
    about = '\n\n'.join(paragraphs) + '\n\nPublic work you can explore:\n' + '\n'.join(
        f"• {p['name']}: {p['line']} {p['url']}" for p in projects
    ) + '\n\nPortfolio: https://jacobmetoyer.com/\nSource: https://github.com/Jacob-Met'
    if len(about) > 2600 or len(presence['linkedin']['headline']) > 220 or len(presence['github']['bio']) > 160:
        raise ValueError('Public profile field exceeds platform limit')
    readme = '''<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./assets/profile-banner-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="./assets/profile-banner-light.svg">
  <img alt="Jacob Metoyer — research, computation, software, and making" src="./assets/profile-banner-light.svg">
</picture>

## Hi, I'm Jacob.

''' + '\n\n'.join(paragraphs) + '\n\n### Public work\n\n| Project | What you can inspect |\n|---|---|\n' + ''.join(
        f"| [**{p['name']}**]({p['url']}) | {p['line']} |\n" for p in projects
    )
    readme += '\n### More research tooling\n\n' + '\n'.join(
        f"- [{p['name']}]({p['url']}) — {p['line']}" for p in content['projects']
    )
    readme += '\n\n### Working together\n\nOpen to research collaborations and scoped pilots: start with a bounded problem, compare with an existing workflow, and measure quality, time, cost and human intervention. No savings or clinical outcomes are implied by a demo.\n\n**[jacobmetoyer.com](https://jacobmetoyer.com/)** · [LinkedIn](https://www.linkedin.com/in/jacob-metoyer-15b701352)\n'
    return paragraphs, about, readme


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    pp = ROOT / 'presence.json'
    cp = ROOT / 'content.json'
    presence = json.loads(pp.read_text(encoding='utf-8'))
    content = json.loads(cp.read_text(encoding='utf-8'))
    paragraphs, about, readme = outputs(presence, content)
    expected = {
        cp: {**content, 'about': {'lines': paragraphs}},
        pp: {**presence, 'linkedin': {**presence['linkedin'], 'about': about}},
    }
    failures = []
    for path, data in expected.items():
        if args.check:
            if json.loads(path.read_text(encoding='utf-8')) != data:
                failures.append(str(path.relative_to(ROOT)))
        else:
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    rp = ROOT / 'profile' / 'README.md'
    if args.check:
        if rp.read_text(encoding='utf-8') != readme:
            failures.append('profile/README.md')
        if failures:
            raise SystemExit('Profile source drift: ' + ', '.join(failures))
    else:
        rp.write_text(readme, encoding='utf-8')
    print(json.dumps({'passed': True, 'check_only': args.check, 'linkedin_about_chars': len(about), 'shared_paragraphs': len(paragraphs), 'featured_projects': len(presence['identity']['featured_work'])}))


if __name__ == '__main__':
    main()
