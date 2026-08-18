import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_u59mRYyFqEPZ@ep-fancy-mouse-ax51nb05.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # List all tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    """)
    tables = cursor.fetchall()
    print(f"Tables in database: {[t[0] for t in tables]}")
    
    # Check if users table exists and get row count
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    """)
    if cursor.fetchone():
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        print(f"Rows in users table: {count}")
        
        # Get all users
        cursor.execute("SELECT email FROM users")
        emails = [row[0] for row in cursor.fetchall()]
        print(f"All emails: {emails}")
    else:
        print("users table does not exist!")
    
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
