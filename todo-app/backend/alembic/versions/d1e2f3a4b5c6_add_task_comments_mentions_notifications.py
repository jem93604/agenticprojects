"""Add task comments, @mention records, and notifications

Revision ID: d1e2f3a4b5c6
Revises: c4d3e2f1a0b9
Create Date: 2026-03-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "d1e2f3a4b5c6"
down_revision = "c4d3e2f1a0b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite non-transactional DDL: tolerate partial runs in development.
    op.execute("DROP TABLE IF EXISTS task_comment_mentions")
    op.execute("DROP TABLE IF EXISTS task_comments")
    op.execute("DROP TABLE IF EXISTS notifications")

    # Indexes are created with IF NOT EXISTS below because SQLite DDL may partially apply
    # and Alembic can roll back statements when a migration fails.

    op.create_table(
        "task_comments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False, index=True),
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), nullable=False, index=True),
        sa.Column("author_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("edited_at", sa.DateTime(), nullable=True),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_task_comments_task_id ON task_comments (task_id)")

    op.create_table(
        "task_comment_mentions",
        sa.Column("comment_id", sa.Integer(), sa.ForeignKey("task_comments.id"), primary_key=True, nullable=False),
        sa.Column("mentioned_user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True, nullable=False),
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_task_comment_mentions_mentioned_user_id ON task_comment_mentions (mentioned_user_id)"
    )

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("type", sa.Text(), nullable=False, index=True),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
        sa.Column("read_at", sa.DateTime(), nullable=True),
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id)")


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_table("notifications")

    op.drop_index(
        op.f("ix_task_comment_mentions_mentioned_user_id"),
        table_name="task_comment_mentions",
    )
    op.drop_table("task_comment_mentions")

    op.drop_index(op.f("ix_task_comments_task_id"), table_name="task_comments")
    op.drop_table("task_comments")

