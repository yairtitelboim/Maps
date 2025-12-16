#!/usr/bin/env python3
"""
Death Signals Analysis - Find projects with negative news signals
"""

import sqlite3
import json
from collections import Counter
from pathlib import Path

# Death signal keywords
DEATH_SIGNALS = {
    'cancelled': ['cancelled', 'canceled', 'cancellation'],
    'delayed': ['delayed', 'postponed', 'paused', 'shelved'],
    'opposition': ['lawsuit', 'opposition', 'protest', 'objection'],
    'denied': ['denied', 'rejected', 'withdrawn', 'pulled'],
    'permit_issues': ['permit expired', 'permit denied', 'permitting delays'],
    'reconsidering': ['reconsidering', 'under review', 'uncertain'],
    'sold': ['land sold', 'site sold', 'property sold']
}

def find_death_signals_in_text(text):
    """Find death signals in article text"""
    if not text:
        return []
    
    text_lower = text.lower()
    found_signals = []
    
    for category, keywords in DEATH_SIGNALS.items():
        for keyword in keywords:
            if keyword in text_lower:
                found_signals.append(category)
                break  # Only count each category once per article
    
    return found_signals

def main():
    base_path = Path(__file__).parent.parent.parent
    db_path = base_path / 'data/news/news_pipeline.db'
    
    if not db_path.exists():
        print(f"❌ Database not found at: {db_path}")
        return
    
    # Connect to database
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    print("=" * 80)
    print("DEATH SIGNALS ANALYSIS - SEARCHING ARTICLE TEXT")
    print("=" * 80)
    print()
    
    # Get all mentions with text
    cursor.execute("""
        SELECT mention_id, title, raw_text, snippet, url, published_at
        FROM mentions
    """)
    
    mentions = cursor.fetchall()
    
    print(f"📊 Total articles in database: {len(mentions)}")
    print()
    
    # Find death signals in articles
    death_mentions = []
    
    for mention in mentions:
        mention_id, title, raw_text, snippet, url, published_at = mention
        
        # Combine all text fields
        full_text = ' '.join(filter(None, [title or '', raw_text or '', snippet or '']))
        
        # Find signals
        signals = find_death_signals_in_text(full_text)
        
        if signals:
            death_mentions.append({
                'mention_id': mention_id,
                'title': title,
                'url': url,
                'published_at': published_at,
                'signals': signals
            })
    
    print(f"🔍 Found {len(death_mentions)} articles with death signals (out of {len(mentions)} total)")
    if len(mentions) > 0:
        print(f"   Percentage with negative signals: {len(death_mentions)/len(mentions)*100:.1f}%")
    print()
    
    # Count signal types
    signal_counts = Counter()
    for death_mention in death_mentions:
        for signal in death_mention['signals']:
            signal_counts[signal] += 1
    
    print("=" * 80)
    print("MOST COMMON DEATH SIGNALS")
    print("=" * 80)
    if signal_counts:
        for signal, count in signal_counts.most_common():
            print(f"  {signal}: {count} articles")
    else:
        print("  No death signals found in articles")
    print()
    
    # Show sample death articles
    if death_mentions:
        print("=" * 80)
        print("SAMPLE ARTICLES WITH DEATH SIGNALS (first 10)")
        print("=" * 80)
        for article in death_mentions[:10]:
            print(f"\n📰 {article['title']}")
            print(f"   Signals: {', '.join(article['signals'])}")
            print(f"   URL: {article['url']}")
            print(f"   Published: {article['published_at']}")
        print()
    
    # Map to projects
    cursor.execute("""
        SELECT project_id, project_name, company, location_text, mention_ids
        FROM projects
    """)
    
    projects = cursor.fetchall()
    
    print(f"📊 Total projects in database: {len(projects)}")
    print()
    
    projects_with_death_signals = []
    
    for project in projects:
        project_id, name, company, location, mention_ids_json = project
        
        if not mention_ids_json:
            continue
        
        try:
            mention_ids = json.loads(mention_ids_json)
        except:
            continue
        
        # Find death signals for this project
        project_signals = []
        death_article_count = 0
        death_article_details = []
        
        for death_mention in death_mentions:
            if death_mention['mention_id'] in mention_ids:
                death_article_count += 1
                project_signals.extend(death_mention['signals'])
                death_article_details.append({
                    'title': death_mention['title'],
                    'url': death_mention['url'],
                    'signals': death_mention['signals']
                })
        
        if death_article_count > 0:
            projects_with_death_signals.append({
                'project_id': project_id,
                'name': name,
                'company': company,
                'location': location,
                'death_articles': death_article_count,
                'signals': list(set(project_signals)),  # Unique signals
                'article_details': death_article_details
            })
    
    print("=" * 80)
    print("PROJECTS WITH DEATH SIGNALS")
    print("=" * 80)
    print(f"Total projects: {len(projects)}")
    print(f"Projects with death signals: {len(projects_with_death_signals)}")
    if len(projects) > 0:
        print(f"Failure/struggle rate: {len(projects_with_death_signals)/len(projects)*100:.1f}%")
    print()
    
    # Show projects sorted by number of death articles
    if projects_with_death_signals:
        print("=" * 80)
        print("PROJECTS WITH NEGATIVE SIGNALS (sorted by article count)")
        print("=" * 80)
        for proj in sorted(projects_with_death_signals, key=lambda x: x['death_articles'], reverse=True):
            print(f"\n🔴 {proj['name']} ({proj['company'] or 'Unknown'}, {proj['location'] or 'Unknown'})")
            print(f"   {proj['death_articles']} negative article(s)")
            print(f"   Signal types: {', '.join(proj['signals'])}")
            if proj['article_details']:
                print(f"   Articles:")
                for article in proj['article_details'][:3]:  # Show first 3
                    print(f"     - {article['title']}")
                    print(f"       {article['url']}")
        print()
    else:
        print("✅ No projects found with death signals in their articles")
        print()
    
    # Geographic analysis
    if projects_with_death_signals:
        location_failures = Counter()
        for proj in projects_with_death_signals:
            location = proj['location'] or 'Unknown'
            location_failures[location] += 1
        
        print("=" * 80)
        print("FAILURES BY LOCATION")
        print("=" * 80)
        if location_failures:
            for location, count in location_failures.most_common(15):
                print(f"  {location}: {count} struggling project(s)")
        print()
    
    # Company analysis
    if projects_with_death_signals:
        company_failures = Counter()
        company_total_projects = Counter()
        
        # Count total projects per company
        for project in projects:
            company = project[2] or 'Unknown'
            company_total_projects[company] += 1
        
        # Count failures per company
        for proj in projects_with_death_signals:
            company = proj['company'] or 'Unknown'
            company_failures[company] += 1
        
        print("=" * 80)
        print("FAILURES BY COMPANY")
        print("=" * 80)
        if company_failures:
            for company, failure_count in company_failures.most_common(15):
                total = company_total_projects.get(company, 0)
                if total > 0:
                    failure_rate = (failure_count / total) * 100
                    print(f"  {company}: {failure_count}/{total} struggling ({failure_rate:.1f}%)")
                else:
                    print(f"  {company}: {failure_count} struggling")
        print()
    
    # Summary statistics
    print("=" * 80)
    print("SUMMARY STATISTICS")
    print("=" * 80)
    print(f"Total articles analyzed: {len(mentions)}")
    print(f"Articles with death signals: {len(death_mentions)}")
    print(f"Total projects: {len(projects)}")
    print(f"Projects with death signals: {len(projects_with_death_signals)}")
    if len(projects) > 0:
        print(f"Overall failure/struggle rate: {len(projects_with_death_signals)/len(projects)*100:.1f}%")
    
    conn.close()

if __name__ == '__main__':
    main()

