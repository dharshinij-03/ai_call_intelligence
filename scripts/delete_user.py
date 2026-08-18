import psycopg2

DATABASE_URL = "postgresql://neondb_owner:npg_u59mRYyFqEPZ@ep-fancy-mouse-ax51nb05.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Delete user by email
    cursor.execute("DELETE FROM users WHERE email = %s", ("dharshini@gmail.com",))
    conn.commit()
    
    print(f"Deleted {cursor.rowcount} user(s) with email: dharshini@gmail.com")
    cursor.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")
