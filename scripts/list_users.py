import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_u59mRYyFqEPZ@ep-fancy-mouse-ax51nb05.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # List all users
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    print(f"Total users in database: {count}")
    
    # List first 5 users
    cursor.execute("SELECT id, email, full_name, role FROM users LIMIT 5")
    for row in cursor.fetchall():
        print(f"  {row}")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
