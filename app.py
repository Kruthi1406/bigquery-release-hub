import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# Route to serve the main HTML page
@app.route('/')
def index():
    return render_template('index.html')

# Route to get the release notes
@app.route('/api/release-notes')
def get_release_notes():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    try:
        # Fetch the feed XML with a User-Agent header
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)'}
        )
        with urllib.request.urlopen(req) as response:
            xml_data = response.read()
            
        # Parse the XML
        root = ET.fromstring(xml_data)
        
        # Atom namespace
        namespace = {'atom': 'http://www.w3.org/2005/Atom'}
        
        entries = []
        for entry in root.findall('atom:entry', namespace):
            title = entry.find('atom:title', namespace)
            entry_id = entry.find('atom:id', namespace)
            updated = entry.find('atom:updated', namespace)
            
            # Find the alternate link
            link_url = ""
            for link in entry.findall('atom:link', namespace):
                if link.get('rel') == 'alternate':
                    link_url = link.get('href')
                    break
            if not link_url:
                # Fallback to first link found
                link = entry.find('atom:link', namespace)
                if link is not None:
                    link_url = link.get('href')
            
            content = entry.find('atom:content', namespace)
            
            entries.append({
                'id': entry_id.text if entry_id is not None else '',
                'title': title.text if title is not None else '',
                'updated': updated.text if updated is not None else '',
                'link': link_url,
                'content': content.text if content is not None else ''
            })
            
        return jsonify({'status': 'success', 'data': entries})
    except urllib.error.URLError as e:
        return jsonify({'status': 'error', 'message': f'Failed to fetch feed: {str(e)}'}), 500
    except ET.ParseError as e:
        return jsonify({'status': 'error', 'message': f'Failed to parse XML: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
