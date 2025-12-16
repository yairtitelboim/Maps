#!/usr/bin/env python3
"""
Comprehensive Hill County Research using Perplexity API
Covers energy infrastructure, ERCOT planning, demand, data centers, and coordination
"""

import requests
import os
import json
from pathlib import Path
from dotenv import load_dotenv
import time

# Load API key
load_dotenv(Path('.env.local'))
PERPLEXITY_API_KEY = os.getenv('PRP')

if not PERPLEXITY_API_KEY:
    print('❌ Perplexity API key not found in .env.local')
    exit(1)

# Comprehensive queries covering all aspects
QUERIES = [
    {
        'category': 'Energy Infrastructure',
        'query': 'What energy infrastructure, power plants, and generation capacity exists in Hill County, Texas? Include natural gas, solar, wind, and battery storage projects. What is the total capacity and who operates these facilities?'
    },
    {
        'category': 'ERCOT Planning',
        'query': 'What ERCOT transmission planning, grid infrastructure, or interconnection projects are planned or underway in Hill County, Texas? Include transmission lines, substations, and grid upgrades.'
    },
    {
        'category': 'Energy Demand',
        'query': 'What is the current and projected energy demand in Hill County, Texas? Are there any major industrial users, data centers, or large electricity consumers in the county? What is driving energy demand growth?'
    },
    {
        'category': 'Data Center Activity',
        'query': 'What data center projects, announcements, or developments are happening in Hill County, Texas? Include all companies, project sizes, timelines, and power requirements. Also check for projects near Hill County or in adjacent counties that might affect Hill County.'
    },
    {
        'category': 'Energy-Data Center Coordination',
        'query': 'Are there any connections between energy infrastructure and data center development in Hill County, Texas? Include power purchase agreements, dedicated power infrastructure, or coordinated development between energy companies and data center operators.'
    },
    {
        'category': 'Recent Developments',
        'query': 'What are the most recent energy or data center developments in Hill County, Texas in 2024 and 2025? Include new project announcements, construction starts, regulatory approvals, or major investments.'
    },
    {
        'category': 'Regional Context',
        'query': 'How does Hill County fit into the broader Central Texas energy and data center landscape? What is happening in adjacent counties like Bosque, McLennan, and Johnson that might affect Hill County?'
    },
    {
        'category': 'Future Planning',
        'query': 'What are the future plans for energy infrastructure expansion or data center development in Hill County, Texas? Include announced projects, regulatory filings, or development proposals for 2026 and beyond.'
    }
]

def run_research():
    """Run comprehensive Perplexity research on Hill County."""
    print('🔍 COMPREHENSIVE HILL COUNTY RESEARCH WITH PERPLEXITY')
    print('=' * 80)
    print()
    
    url = 'https://api.perplexity.ai/chat/completions'
    headers = {
        'Authorization': f'Bearer {PERPLEXITY_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    results = []
    
    for i, query_obj in enumerate(QUERIES, 1):
        category = query_obj['category']
        query = query_obj['query']
        
        print(f'Query {i}/{len(QUERIES)}: [{category}]')
        print(f'  {query[:100]}...')
        
        payload = {
            'model': 'sonar-pro',
            'messages': [
                {
                    'role': 'system',
                    'content': 'You are a research assistant specializing in energy infrastructure and data center development in Texas. Provide detailed, factual information with specific numbers, dates, companies, and project details. Focus on Hill County, Texas specifically, but also include relevant context from adjacent counties.'
                },
                {
                    'role': 'user',
                    'content': query
                }
            ],
            'temperature': 0.2,
            'max_tokens': 1500
        }
        
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=45)
            response.raise_for_status()
            
            result = response.json()
            if 'choices' in result and len(result['choices']) > 0:
                content = result['choices'][0]['message']['content']
                results.append({
                    'category': category,
                    'query': query,
                    'response': content
                })
                print(f'  ✅ Response received ({len(content)} chars)')
            else:
                print(f'  ❌ Unexpected response format')
        except Exception as e:
            print(f'  ❌ Error: {e}')
        
        print()
        time.sleep(3)  # Rate limiting
    
    # Save results
    output_path = Path('data/analysis/hill_county_comprehensive_research.json')
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f'💾 Results saved to: {output_path}')
    print()
    print('📊 SUMMARY:')
    print(f'  • {len(results)} queries completed')
    print(f'  • Total information gathered: {sum(len(r["response"]) for r in results)} chars')
    categories = ', '.join([r["category"] for r in results])
    print(f'  • Categories covered: {categories}')
    
    return results

if __name__ == '__main__':
    results = run_research()

