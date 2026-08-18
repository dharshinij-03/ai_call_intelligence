import asyncio
from sqlalchemy import text
from app.database import engine

async def add_columns():
    async with engine.begin() as conn:
        await conn.execute(text("""
            ALTER TABLE call_sessions 
            ADD COLUMN IF NOT EXISTS latitude FLOAT;
        """))
        await conn.execute(text("""
            ALTER TABLE call_sessions 
            ADD COLUMN IF NOT EXISTS longitude FLOAT;
        """))
        await conn.execute(text("""
            ALTER TABLE call_sessions 
            ADD COLUMN IF NOT EXISTS location_accuracy FLOAT;
        """))
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_call_sessions_latitude 
            ON call_sessions(latitude);
        """))
        print("✓ All columns added successfully!")

if __name__ == "__main__":
    asyncio.run(add_columns())
