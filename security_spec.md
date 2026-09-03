# Firestore Security Specifications

## Collections & Permissions

### `users/{userId}` and `user_data/{userId}`
- Read: Allowed for authenticated users and owners.
- Write: Allowed for owner or admin.
- Subcollections (`test_results`, `history`): Allowed for owner.

### `config/{document}` & public tables
- Read: Publicly readable for app configuration, system settings, and sharded content.
- Write: Restricted to administrative users.

### `schools/{schoolId}` & `coachings/{coachingId}`
- Read: Accessible by affiliated students, teachers, and admins.
- Write: Admin and authorized personnel.
