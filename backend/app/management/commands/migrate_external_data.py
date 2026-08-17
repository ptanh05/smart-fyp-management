"""
Data migration script for adding external evaluation support to existing data.
Run this after applying the new model migrations.
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from app.models import (
    SupervisorOfStudentGroup,
)


class Command(BaseCommand):
    help = "Migrates existing data for external evaluation support"

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run migration without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        self.stdout.write(self.style.WARNING(
            f"Starting data migration {'(DRY RUN)' if dry_run else ''}..."
        ))

        try:
            with transaction.atomic():
                # 1. Update all 8th semester students' groups for external readiness
                self.update_external_readiness(dry_run)

                # 2. Set default external_evaluation_status
                self.set_default_external_status(dry_run)

                if dry_run:
                    self.stdout.write(self.style.WARNING(
                        "\nDRY RUN complete. No changes made."
                    ))
                    raise Exception("Dry run rollback")
        except Exception as e:
            if dry_run and str(e) == "Dry run rollback":
                return
            raise

        self.stdout.write(self.style.SUCCESS("\nMigration completed successfully!"))

    def update_external_readiness(self, dry_run):
        """
        Mark groups as ready for external if they have completed internal evaluations.
        """
        self.stdout.write("Updating external readiness flags...")

        # Find all accepted supervisor groups with 8th semester students
        groups = SupervisorOfStudentGroup.objects.filter(
            status='accepted'
        ).select_related('group__student_1', 'group__student_2')

        updated = 0
        for group in groups:
            # Check if any student is in 8th semester
            is_8th_semester = (
                (group.group.student_1 and
                 getattr(group.group.student_1, 'semester', None) == 'semester_8') or
                (group.group.student_2 and
                 getattr(group.group.student_2, 'semester', None) == 'semester_8')
            )

            # Check if internal evaluations (Eval4) exist
            has_eval4 = (
                group.evaluation4_supervisor is not None and
                group.evaluation4_committee_member is not None
            )

            if is_8th_semester and has_eval4 and not group.is_ready_for_external:
                if not dry_run:
                    group.is_ready_for_external = True
                    group.save(update_fields=['is_ready_for_external'])
                updated += 1

        self.stdout.write(
            f"  {'Would update' if dry_run else 'Updated'} {updated} groups"
        )

    def set_default_external_status(self, dry_run):
        """
        Set default external_evaluation_status for all groups.
        """
        self.stdout.write("Setting default external evaluation status...")

        # Groups not ready for external -> not_applicable
        not_ready = SupervisorOfStudentGroup.objects.filter(
            is_ready_for_external=False
        )
        count_not_applicable = not_ready.count()

        if not dry_run:
            not_ready.update(external_evaluation_status='not_applicable')

        # Groups ready but not assigned -> pending_assignment
        ready_not_assigned = SupervisorOfStudentGroup.objects.filter(
            is_ready_for_external=True,
            external_assignment__isnull=True
        )
        count_pending = ready_not_assigned.count()

        if not dry_run:
            ready_not_assigned.update(external_evaluation_status='pending_assignment')

        self.stdout.write(
            f"  {'Would set' if dry_run else 'Set'} {count_not_applicable} as not_applicable"
        )
        self.stdout.write(
            f"  {'Would set' if dry_run else 'Set'} {count_pending} as pending_assignment"
        )
