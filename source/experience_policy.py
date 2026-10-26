"""Public-safe display projection for the approved captured portfolio."""
from __future__ import annotations
import json
import re
from pathlib import Path

EXPERIENCE_FILE = 'experience-content.json'
PROJECT_IDS = {'phantom-window', 'captionverse', 'domino', 'replay-forge', 'spire', 'hamon-engine', 'lanternwake'}
RELATED_IDS = {'threadline', 'familiar-memories', 'threshold', 'ledgerdock', 'teachback', 'wildside', 'clearway'}
CONTACT_URLS = {'https://github.com/Jacob-Met', 'https://www.linkedin.com/in/jacob-metoyer-15b701352'}
PUBLIC_LINKS = CONTACT_URLS | {'https://github.com/Jacob-Met/CaptureSuite', 'https://spireofoctaves.com/',
                             'https://www.royalroad.com/fiction/183255/seamwork', 'https://spireofoctaves.com/stories/salts-end',
                             'https://jacobmetoyer.com/games/lanternwake/'}
INTERACTIONS = {'phantom-window': {'recorded-comparison', 'recorded-provenance'},
                'captionverse': {'captured-examples'}, 'domino': {'recorded-repair'},
                'replay-forge': {'court-study'}, 'spire': {'world-reading'},
                'lanternwake': {'play-game'}, 'about': {'research-background'},
                'hamon-engine': {'engine-overview'}, 'research': {'research-background'}}
HIERARCHY = {'flagshipWithinHamon': 'hamon-engine', 'coreDestinations': ['research', 'hamon'],
             'aliases': {'about': 'research', 'work': 'hamon'},
             'softwareProjectIds': ['phantom-window', 'captionverse', 'domino', 'replay-forge'],
             'secondaryGameIds': ['lanternwake']}
PATH_TARGETS = {'look-closer': ['spire'], 'inspect-evidence': ['research'],
                'follow-mechanism': ['hamon-engine', 'lanternwake']}



def exact(value, fields, label):
    if not isinstance(value, dict) or set(value) != set(fields): raise ValueError('Unexpected ' + label + ' fields')


def plain(value, limit=1000):
    if (not isinstance(value, str) or not 1 <= len(value) <= limit or '<' in value or '>' in value
            or any(ord(c) < 32 for c in value)):
        raise ValueError('Experience copy must be bounded plain text')


def texts(value, fields):
    for field in fields: plain(value[field])


def links(actions, allowed=PUBLIC_LINKS):
    if not isinstance(actions, list) or not 1 <= len(actions) <= 3: raise ValueError('Expected a bounded action list')
    for action in actions:
        exact(action, {'label', 'url'}, 'public action'); plain(action['label'], 140)
        if action['url'] not in allowed: raise ValueError('Action is outside the verified public destinations')


def validate_experience(data):
    exact(data, {'schema', 'updated', 'visibility', 'entry', 'publicBio', 'journeys', 'projectStories',
                 'recordedRepairChoices', 'connections', 'relatedWork', 'hierarchy', 'researchWork', 'hamonBranches'}, 'experience display record')
    if data['schema'] != 1 or data['visibility'] != 'public-captured' or not isinstance(data['updated'], str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', data['updated']):
        raise ValueError('Experience must be the dated approved captured-public projection')
    hierarchy = data['hierarchy']; exact(hierarchy, set(HIERARCHY) | {'pillars'}, 'three-pillar hierarchy')
    if {key: hierarchy[key] for key in HIERARCHY} != HIERARCHY: raise ValueError('Research, HAMON, and supporting-work hierarchy must remain explicit')
    pillars = hierarchy['pillars']
    if not isinstance(pillars, list) or len(pillars) != 3: raise ValueError('Expected the three primary destinations')
    for pillar, expected_id in zip(pillars, ['research', 'hamon', 'spire']):
        exact(pillar, {'id', 'title', 'summary', 'description', 'action'}, 'pillar'); texts(pillar, {'id', 'title', 'summary', 'description'})
        if pillar['id'] != expected_id: raise ValueError('Primary destination order or identity drift')
        action = pillar['action']; exact(action, {'label', 'url' if expected_id == 'spire' else 'route'}, 'pillar action'); plain(action['label'])
        if expected_id == 'spire':
            if action['url'] != 'https://spireofoctaves.com/': raise ValueError('Spire must retain its direct public destination')
        elif action['route'] != expected_id: raise ValueError('Pillar route must match its reviewed destination')
    entry = data['entry']; fields = {'heading', 'lead', 'browseLabel', 'returnLabel', 'journeyNote'}
    exact(entry, fields, 'experience entry'); texts(entry, fields)
    bio = data['publicBio']; fields = {'name', 'intro', 'research', 'interests', 'researchHeading', 'researchLead', 'contactLead', 'links', 'researchResource', 'researchSections'}
    exact(bio, fields, 'public biography'); texts(bio, fields - {'links', 'researchResource', 'researchSections'})
    if bio['name'] != 'Jacob Metoyer': raise ValueError('Experience identity drift')
    links(bio['links'], CONTACT_URLS)
    if len(bio['links']) != 2: raise ValueError('Expected exactly the two approved contact links')
    if {link['url'] for link in bio['links']} != CONTACT_URLS: raise ValueError('Both approved contact routes must remain')
    resource = bio['researchResource']; fields = {'name', 'description', 'limit', 'actionLabel', 'url'}
    exact(resource, fields, 'research resource'); texts(resource, fields - {'url'})
    if resource['url'] != 'https://github.com/Jacob-Met/CaptureSuite': raise ValueError('Unreviewed research destination')
    sections = bio['researchSections']
    if not isinstance(sections, list) or len(sections) != 2: raise ValueError('Research must include academic and independent work')
    for section, expected in zip(sections, [('academic', []), ('independent', ['phantom-window', 'domino', 'replay-forge'])]):
        exact(section, {'id', 'title', 'lead', 'detail', 'projectIds'}, 'research section'); texts(section, {'id', 'title', 'lead', 'detail'})
        if section['id'] != expected[0] or section['projectIds'] != expected[1]: raise ValueError('Research section scope differs from the reviewed record')
    research = data['researchWork']; exact(research, {'academic', 'independent'}, 'research work')
    expected_research = {'academic': ['gait-rehabilitation', 'behavioral-neurobiology', 'molecular-dynamics', 'surgical-ergonomics'],
                         'independent': ['worldlaw', 'kernel-garden', 'computational-memory']}
    for kind, ids in expected_research.items():
        items = research[kind]
        if not isinstance(items, list) or len(items) != len(ids): raise ValueError('Research inventory differs from reviewed academic and independent work')
        for item, expected_id in zip(items, ids):
            fields = {'id', 'name', 'focus'} if kind == 'academic' else {'id', 'name', 'question', 'output', 'detail', 'stage', 'limit', 'publicUrl'}
            exact(item, fields, 'research entry'); texts(item, fields - {'publicUrl'})
            if item['id'] != expected_id: raise ValueError('Research entry identity drift')
            if kind == 'independent' and item['publicUrl'] is not None: raise ValueError('Independent research repositories remain private')
    branches = data['hamonBranches']
    expected_branches = {'engine': ['hamon-engine'], 'hackathons': ['domino', 'phantom-window', 'replay-forge'],
                         'projects': ['phantom-window', 'captionverse', 'domino', 'replay-forge', 'lanternwake']}
    if not isinstance(branches, list) or len(branches) != 3: raise ValueError('Expected Engine, Hackathons, and Projects branches')
    for branch, (expected_id, project_ids) in zip(branches, expected_branches.items()):
        exact(branch, {'id', 'title', 'lead', 'projectIds', 'entries'}, 'HAMON branch'); texts(branch, {'id', 'title', 'lead'})
        if branch['id'] != expected_id or branch['projectIds'] != project_ids: raise ValueError('HAMON branch scope differs from the reviewed hierarchy')
        entries = branch['entries']
        if expected_id != 'hackathons':
            if entries != []: raise ValueError('Only the reviewed hackathon branch has additional records')
            continue
        if not isinstance(entries, list) or len(entries) != 5: raise ValueError('Expected five reviewed competition-built entries')
        for entry, entry_id in zip(entries, ['domino', 'phantom-window', 'replay-forge', 'replayforge-debugging', 'shadewindow']):
            fields = {'id', 'name', 'category', 'purpose', 'status', 'limit', 'projectId', 'publicUrl'}
            exact(entry, fields, 'hackathon entry'); texts(entry, fields - {'projectId', 'publicUrl'})
            if entry['id'] != entry_id: raise ValueError('Unknown competition-built project')
            public_entries = {'shadewindow': 'https://devpost.com/software/shadewindow',
                              'replayforge-debugging': 'https://devpost.com/software/replayforge-ypvoia'}
            project_id, url = (None, public_entries[entry_id]) if entry_id in public_entries else (entry_id, None)
            if entry['projectId'] != project_id or entry['publicUrl'] != url: raise ValueError('Hackathon entry has an unreviewed destination or private-source link')
    journeys = data['journeys']
    if not isinstance(journeys, list) or len(journeys) != 3: raise ValueError('Expected three reviewed paths through the work')
    journey_ids = set()
    for journey in journeys:
        fields = {'id', 'title', 'audience', 'lead', 'steps', 'ending', 'motivation'}; exact(journey, fields, 'journey')
        texts(journey, fields - {'steps', 'ending'})
        if journey['id'] not in PATH_TARGETS or journey['id'] in journey_ids: raise ValueError('Unknown or duplicate journey')
        journey_ids.add(journey['id'])
        if not isinstance(journey['steps'], list) or len(journey['steps']) != len(PATH_TARGETS[journey['id']]): raise ValueError('Path must preserve the reviewed major-work hierarchy')
        for step in journey['steps']:
            fields = {'projectId', 'prompt', 'body', 'actionLabel', 'interactionId'}; exact(step, fields, 'journey step'); texts(step, fields)
            if step['projectId'] not in INTERACTIONS or step['interactionId'] not in INTERACTIONS[step['projectId']]: raise ValueError('Journey points to an undeclared interaction')
        if [step['projectId'] for step in journey['steps']] != PATH_TARGETS[journey['id']]: raise ValueError('Path destinations differ from the reviewed major-work hierarchy')
        ending = journey['ending']; extra = {'url'} if 'url' in ending else {'destination'}
        exact(ending, {'heading', 'body', 'actionLabel'} | extra, 'journey ending'); texts(ending, {'heading', 'body', 'actionLabel'})
        if extra == {'url'} and ending['url'] not in (CONTACT_URLS | ({'https://spireofoctaves.com/'} if journey['id'] == 'look-closer' else set())): raise ValueError('Path ending is not an approved destination')
        if extra == {'destination'} and ending['destination'] != 'workspace': raise ValueError('Unknown internal journey ending')
    stories = data['projectStories']
    if not isinstance(stories, list) or len(stories) != len(PROJECT_IDS): raise ValueError('Expected the seven reviewed project stories')
    ids = set()
    for story in stories:
        fields = {'projectId', 'question', 'opening', 'capability', 'tryThis', 'stage', 'limit', 'previewMode', 'next'}
        exact(story, fields | ({'actions'} if 'actions' in story else set()), 'project story'); texts(story, fields - {'next'})
        if story['projectId'] not in PROJECT_IDS or story['projectId'] in ids: raise ValueError('Unknown or duplicate story')
        ids.add(story['projectId']); exact(story['next'], {'projectId', 'label'}, 'related story'); plain(story['next']['label'])
        if story['next']['projectId'] not in PROJECT_IDS: raise ValueError('Unknown next project')
        if 'actions' in story:
            allowed = {'spire': {'https://spireofoctaves.com/', 'https://spireofoctaves.com/stories/salts-end', 'https://www.royalroad.com/fiction/183255/seamwork'},
                       'lanternwake': {'https://jacobmetoyer.com/games/lanternwake/'}}.get(story['projectId'], set())
            links(story['actions'], allowed)
    repair = data['recordedRepairChoices']; fields = {'projectId', 'heading', 'intro', 'choices', 'limit'}
    exact(repair, fields, 'recorded repair'); texts(repair, fields - {'choices'})
    if repair['projectId'] != 'domino' or not isinstance(repair['choices'], list) or len(repair['choices']) != 3: raise ValueError('Repair record must remain the three recorded Domino choices')
    choice_ids = set()
    for choice in repair['choices']:
        fields = {'id', 'label', 'change', 'outcome', 'verdict'}; exact(choice, fields, 'recorded choice'); texts(choice, fields)
        if choice['id'] not in {'delay', 'disable', 'guard'} or choice['id'] in choice_ids: raise ValueError('Unknown or duplicate repair choice')
        choice_ids.add(choice['id'])
    connections = data['connections']
    if not isinstance(connections, list) or not 1 <= len(connections) <= 12: raise ValueError('Expected a bounded connection list')
    pairs = set()
    for connection in connections:
        fields = {'from', 'to', 'label', 'description'}; exact(connection, fields, 'connection'); texts(connection, fields)
        pair = (connection['from'], connection['to'])
        if pair in pairs or pair[0] == pair[1] or not set(pair) <= PROJECT_IDS | {'about'}: raise ValueError('Invalid or duplicate project connection')
        pairs.add(pair)
    related = data['relatedWork']
    if not isinstance(related, list) or len(related) != len(RELATED_IDS): raise ValueError('Expected the reviewed related-work inventory')
    related_ids = set()
    for work in related:
        fields = {'id', 'name', 'theme', 'question', 'description', 'stage', 'limit', 'publicSourceUrl', 'relatedTo', 'connectionLabel', 'connectionDescription'}
        exact(work, fields, 'related work'); texts(work, fields - {'publicSourceUrl'})
        if work['id'] not in RELATED_IDS or work['id'] in related_ids: raise ValueError('Unknown or duplicate related work')
        related_ids.add(work['id'])
        if work['relatedTo'] not in PROJECT_IDS | {'about'}: raise ValueError('Related work points to an undeclared project')
        if work['publicSourceUrl'] is not None: raise ValueError('Private related-work repositories cannot become public links')


def load_experience(root: Path):
    path = root / EXPERIENCE_FILE
    if not path.is_file() or path.is_symlink() or not 1 <= path.stat().st_size <= 120_000:
        raise ValueError('Missing, symlinked or oversized experience record')
    data = json.loads(path.read_text(encoding='utf-8')); validate_experience(data); return data
