"""add no-highway drive time and meets_filters

Revision ID: a1b2c3d4e5f6
Revises: 7c444bf4394c
Create Date: 2026-06-03 16:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '7c444bf4394c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'commute_analyses',
        sa.Column(
            'drive_time_no_highways_peak_minutes',
            sa.Float(),
            nullable=False,
            server_default='0',
        ),
    )
    op.add_column(
        'recommendations',
        sa.Column(
            'meets_filters',
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('recommendations', 'meets_filters')
    op.drop_column('commute_analyses', 'drive_time_no_highways_peak_minutes')
