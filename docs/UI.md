# CRM UI Rules

## 1. Goals

The CRM UI should be clean, fast, consistent, easy to understand, and optimized for desktop CRM work.

Do not overload screens with unnecessary information.

---

## 2. Main Layout

```text
AppShell
├── Sidebar
├── Top Navigation
├── Action Bar
└── Content Area
```

Sidebar modules:

- Dashboard
- CRM
- Tasks
- Calendar
- Reports
- Automation
- Settings

Keep the Sidebar simple.

---

## 3. Action Bar

List pages should support where appropriate:

- Create
- Search
- Filter
- View Switcher
- Bulk Actions

---

## 4. Reusable Components

Prefer shared components:

```text
DataTable
SearchBar
FilterPanel
Pagination
BulkActions
Drawer
Modal
ConfirmDialog
Form
TextField
TextareaField
SelectField
DateField
CurrencyField
UserField
KanbanBoard
KanbanColumn
KanbanCard
EmptyState
LoadingState
ErrorState
```

Do not duplicate components without reason.

---

## 5. DataTable and Pagination

Use shared DataTable architecture for Leads, Contacts, Companies, Deals, Tasks, and Products.

Capabilities:

- columns
- sorting
- search
- filters
- pagination
- row selection
- bulk actions

Use server-side pagination. Default: 50 records per page.

---

## 6. Filters

Use reusable filtering infrastructure.

Example Deal filters:

- Pipeline
- Stage
- Owner
- Amount
- Source
- Contact
- Company
- Created Date
- Close Date

Feature filter fields may differ, but the UI pattern should remain consistent.

---

## 7. Kanban and Deal Cards

Kanban is primarily a Deal view.

```text
Pipeline
├── Stage
│   ├── Deal Card
│   └── Deal Card
└── Stage
```

Stages must be dynamic. Never hard-code Stage names.

Deal Cards should show only important information:

- Deal Name
- Amount
- Contact / Company
- Owner
- Tags

---

## 8. Forms

Create/Edit forms may use a Drawer, Modal, or dedicated page depending on complexity.

Fields must have:

- clear labels
- validation
- near-field errors
- loading state
- duplicate-submit protection

---

## 9. Detail Pages

Lead, Contact, Company, and Deal detail pages should generally contain:

```text
Header
Main Information
Related Data
Timeline
Tasks / Activities
```

Deal details may additionally contain Pipeline, Stage, Products, and Won/Lost status.

---

## 10. UI States and Confirmation

Every data screen must handle:

- Loading
- Empty
- Error
- Success

Dangerous operations require confirmation, including Delete, Convert Lead, Mark Lost, Remove Member, Delete Pipeline, and Delete Stage.

---

## 11. Responsive and Design System

MVP priority:

1. Desktop.
2. Tablet.
3. Basic mobile responsiveness.

Use Tailwind CSS and shadcn/ui.

Prefer existing shadcn/ui components before creating new primitives. Do not introduce another UI framework without an explicit ticket.

---

## 12. Consistency and Client Components

Modules should share spacing, buttons, forms, tables, filters, drawers, modals, loading states, empty states, and error states.

Prefer Server Components by default.

Use Client Components only when necessary for interactive forms, drag and drop, modal state, browser APIs, or real-time interaction.

Avoid unnecessary client JavaScript.

---

## 13. Agent Rules

When working on UI:

- reuse existing components
- do not redesign unrelated screens
- do not add a second UI library
- do not hard-code business data
- do not modify screens outside the ticket
- maintain consistent layout and spacing
