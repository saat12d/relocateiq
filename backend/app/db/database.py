"""
This module is a declaritive base for RelocateIQ

This is where the DB connection.  When we define anything else in the backend 
that touches the DB, it will have to go through the objects we defined here
    - engine --> connection pool to postgres
    - 'SessionLocal' --> isi a facotry for per request db sessions
    - 'Base' --> the parent class for all ORM models
    - 'get_db': a FastAPI dependency that results in a session and cleans up
    - 'init_db' : creates all tables in the database, only run once during set up

"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase


# Load environment variable from .env into os.environ
# This should be ran before we read DATABASE_URL
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
#checking for any potential error with retrieving url
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Make sure backend/.env exists and has the DATABASE_URL line filled out")


#engine manages a range of connections to Postgres
#SQLAlchemy reuses these connections accross requests instead of consistently opening a new TCP connection
# all the time, much faster this way
engine = create_engine(DATABASE_URL, echo=True, future=True)
#sessionLocal is a facotry : calling SessionLocal will give us a new Session
# which is a single unit of work, endpoints will get one of these via the get_db dep
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit = False)

#now for the classes holders
#base will be the parent for all ORM models
#will implement later
class Base(DeclarativeBase):
    pass

#FastAPI dep that hands out a db session
#usage in an endpoint
    # @app.get("/items")

#the yield attern makes sure that the session is closed
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db() -> None:
    
    """
    Creating all the tables defined by classes that inherit from Base
    Run only once after postgres the schema models are defined

    Does not matter if ran more than once, postgres skips existing tables
    """
    #importing models ensures that every model class is registered
    #with Base.metadata before create_all runs
    #we have to do it here to avoid a circular import
    from app.db import models
    #create al lissues CREATE TABLE statements to all of the classes 
    Base.metadata.create_all(bind=engine)
