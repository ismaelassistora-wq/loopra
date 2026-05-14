import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

def check_data():
    print("Checking 'posts' table...")
    posts = supabase.table("posts").select("*").limit(5).execute()
    print(f"Found {len(posts.data)} posts.")
    
    print("\nChecking 'post_comments' table...")
    comments = supabase.table("post_comments").select("*").limit(5).execute()
    print(f"Found {len(comments.data)} comments.")
    if len(comments.data) > 0:
        print("Sample comment:", comments.data[0])

if __name__ == "__main__":
    check_data()
