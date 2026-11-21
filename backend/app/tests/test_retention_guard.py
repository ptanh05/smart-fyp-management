"""Regression: data retention must reject years < 1 (cutoff in the future would wipe every closed batch)."""
from datetime import timedelta

from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from app import feature_services as fs
from app.models import AcademicBatch, CustomUser


class RetentionYearsGuardTests(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = CustomUser.objects.create_user(username="ret_admin", password="x", user_type="admin", is_staff=True)
        self.student = CustomUser.objects.create_user(username="ret_sv", password="x", user_type="student")
        # Closed only last month: well inside any real retention window.
        self.recent = AcademicBatch.objects.create(
            batch_code="RET_RECENT", batch_name="Đợt vừa đóng", is_closed=True,
            end_date=timezone.localdate() - timedelta(days=30),
        )

    def test_service_rejects_zero_and_negative_years(self):
        for bad in (0, -1, -10):
            with self.assertRaises(ValueError):
                fs.apply_data_retention(years=bad, apply=False)

    def test_apply_endpoint_rejects_zero_years_and_deletes_nothing(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post("/app/admin/data-retention/apply/", {"confirm": True, "years": 0}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertTrue(AcademicBatch.objects.filter(pk=self.recent.pk).exists())

    def test_preview_endpoint_rejects_negative_years(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get("/app/admin/data-retention/preview/", {"years": "-1"})
        self.assertEqual(res.status_code, 400)

    def test_recent_batch_not_in_scope_with_valid_years(self):
        summary = fs.apply_data_retention(years=1, apply=False)
        self.assertNotIn(self.recent.batch_code, str(summary))

    def test_apply_requires_admin_and_confirm(self):
        self.client.force_authenticate(user=self.student)
        res = self.client.post("/app/admin/data-retention/apply/", {"confirm": True, "years": 5}, format="json")
        self.assertIn(res.status_code, (401, 403))
        self.client.force_authenticate(user=self.admin)
        res = self.client.post("/app/admin/data-retention/apply/", {"years": 5}, format="json")
        self.assertEqual(res.status_code, 400)
