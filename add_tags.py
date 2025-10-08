#!/usr/bin/env python
import os
import sys
import django
import csv

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'django_project.settings')
django.setup()

from images.models import Tag

def add_tags_from_csv(csv_file='sample_tags.csv'):
    """Add tags from CSV file to database"""
    
    if not os.path.exists(csv_file):
        print(f"Error: {csv_file} not found!")
        return
    
    created_count = 0
    skipped_count = 0
    
    with open(csv_file, 'r') as file:
        reader = csv.DictReader(file)
        
        for row in reader:
            tag_name = row.get('Tag Name', '').strip().lower()
            
            if tag_name:
                tag, created = Tag.objects.get_or_create(name=tag_name)
                if created:
                    print(f"✓ Created tag: {tag_name}")
                    created_count += 1
                else:
                    print(f"- Skipped (already exists): {tag_name}")
                    skipped_count += 1
    
    print(f"\n{'='*50}")
    print(f"Import complete!")
    print(f"Created: {created_count} new tags")
    print(f"Skipped: {skipped_count} existing tags")
    print(f"{'='*50}")

if __name__ == '__main__':
    csv_file = sys.argv[1] if len(sys.argv) > 1 else 'sample_tags.csv'
    add_tags_from_csv(csv_file)
