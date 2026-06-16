import os
import requests
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template
from bs4 import BeautifulSoup

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_content_html(content_html, default_date, entry_link):
    """
    Parses the HTML content of a single Atom feed entry, 
    splitting it by <h3> tags representing individual updates.
    """
    soup = BeautifulSoup(content_html, 'html.parser')
    updates = []
    current_type = None
    current_elements = []
    
    for child in soup.contents:
        if child.name == 'h3':
            # Save the previous update
            if current_type and current_elements:
                update_html = "".join(str(e) for e in current_elements)
                text_content = BeautifulSoup(update_html, 'html.parser').get_text(separator=' ').strip()
                updates.append({
                    'type': current_type,
                    'content_html': update_html,
                    'content_text': text_content,
                    'date': default_date,
                    'link': entry_link
                })
            current_type = child.get_text().strip()
            current_elements = []
        else:
            if current_type is not None:
                current_elements.append(child)
            
    # Save the last update
    if current_type and current_elements:
        update_html = "".join(str(e) for e in current_elements)
        text_content = BeautifulSoup(update_html, 'html.parser').get_text(separator=' ').strip()
        updates.append({
            'type': current_type,
            'content_html': update_html,
            'content_text': text_content,
            'date': default_date,
            'link': entry_link
        })
        
    # Fallback if no <h3> headers exist
    if not updates and content_html.strip():
        text_content = soup.get_text(separator=' ').strip()
        updates.append({
            'type': 'Update',
            'content_html': content_html,
            'content_text': text_content,
            'date': default_date,
            'link': entry_link
        })
        
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        
        # Parse the Atom XML feed
        # Atom feed elements use the namespaces: {http://www.w3.org/2005/Atom}
        ns = {'atom': 'http://www.w3.org/2005/Atom'}
        root = ET.fromstring(response.content)
        
        all_updates = []
        
        # Iterate over each <entry> in the Atom feed
        for entry in root.findall('atom:entry', ns):
            title_elem = entry.find('atom:title', ns)
            date = title_elem.text.strip() if title_elem is not None else "Unknown Date"
            
            # Find the link
            link_elem = entry.find("atom:link[@rel='alternate']", ns)
            link = ""
            if link_elem is not None:
                link = link_elem.attrib.get('href', '')
            else:
                # Fallback to any link
                link_elem = entry.find("atom:link", ns)
                if link_elem is not None:
                    link = link_elem.attrib.get('href', '')
            
            # Find content
            content_elem = entry.find('atom:content', ns)
            if content_elem is not None:
                content_html = content_elem.text
                if content_html:
                    entry_updates = parse_content_html(content_html, date, link)
                    all_updates.extend(entry_updates)
                    
        return jsonify({
            'status': 'success',
            'count': len(all_updates),
            'updates': all_updates
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
