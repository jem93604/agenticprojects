"""Add tasks and task assignees for Kanban

Revision ID: c4d3e2f1a0b9
Revises: b3c2d1e0f9a1
Create Date: 2026-03-20 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "c4d3e2f1a0b9"
down_revision = "b3c2d1e0f9a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This migration may be re-run in development after partial failures.
    # SQLite DDL is non-transactional, so we defensively drop partially created tables.
    op.execute("DROP TABLE IF EXISTS task_assignees")
    op.execute("DROP TABLE IF EXISTS tasks")

    op.create_table(
        "tasks",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("project_id", sa.Integer(), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="TODO"),
        sa.Column("due_date", sa.DateTime(), nullable=True),
        sa.Column("importance", sa.String(length=20), nullable=False, server_default="MEDIUM"),
        sa.Column("urgent_override", sa.Boolean(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    # Create indexes explicitly. If they already exist from a previous partial run,
    # they are dropped before recreating.
    op.execute("DROP INDEX IF EXISTS ix_tasks_project_id")
    op.execute("DROP INDEX IF EXISTS ix_tasks_status")
    op.execute("DROP INDEX IF EXISTS ix_tasks_importance")
    op.create_index(op.f("ix_tasks_project_id"), "tasks", ["project_id"], unique=False)
    op.create_index(op.f("ix_tasks_status"), "tasks", ["status"], unique=False)
    op.create_index(op.f("ix_tasks_importance"), "tasks", ["importance"], unique=False)

    op.create_table(
        "task_assignees",
        sa.Column("task_id", sa.Integer(), sa.ForeignKey("tasks.id"), primary_key=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True, nullable=False),
    )
    op.execute("DROP INDEX IF EXISTS ix_task_assignees_user_id")
    op.create_index(op.f("ix_task_assignees_user_id"), "task_assignees", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_task_assignees_user_id"), table_name="task_assignees")
    op.drop_table("task_assignees")

    op.drop_index(op.f("ix_tasks_importance"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_status"), table_name="tasks")
    op.drop_index(op.f("ix_tasks_project_id"), table_name="tasks")
    op.drop_table("tasks")

