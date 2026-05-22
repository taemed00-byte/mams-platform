import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./shared/components/layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'cases', loadComponent: () => import('./features/cases/cases-list/cases-list.component').then(m => m.CasesListComponent) },
      { path: 'cases/new', loadComponent: () => import('./features/cases/case-form/case-form.component').then(m => m.CaseFormComponent) },
      { path: 'cases/:id', loadComponent: () => import('./features/cases/case-detail/case-detail.component').then(m => m.CaseDetailComponent) },
      { path: 'cases/:id/edit', loadComponent: () => import('./features/cases/case-form/case-form.component').then(m => m.CaseFormComponent) },
      { path: 'providers', loadComponent: () => import('./features/providers/providers-list/providers-list.component').then(m => m.ProvidersListComponent) },
      { path: 'providers/new', loadComponent: () => import('./features/providers/provider-form/provider-form.component').then(m => m.ProviderFormComponent) },
      { path: 'providers/:id', loadComponent: () => import('./features/providers/provider-detail/provider-detail.component').then(m => m.ProviderDetailComponent) },
      { path: 'finance', loadComponent: () => import('./features/finance/finance.component').then(m => m.FinanceComponent) },
      { path: 'finance/invoices/new', loadComponent: () => import('./features/finance/invoice-form/invoice-form.component').then(m => m.InvoiceFormComponent) },
      { path: 'finance/invoices/:id', loadComponent: () => import('./features/finance/invoice-detail/invoice-detail.component').then(m => m.InvoiceDetailComponent) },
      { path: 'clients', loadComponent: () => import('./features/clients/clients-list/clients-list.component').then(m => m.ClientsListComponent) },
      { path: 'clients/new', loadComponent: () => import('./features/clients/client-form/client-form.component').then(m => m.ClientFormComponent) },
      { path: 'clients/:id', loadComponent: () => import('./features/clients/client-detail/client-detail.component').then(m => m.ClientDetailComponent) },
      { path: 'insurance', loadComponent: () => import('./features/insurance/insurance-list/insurance-list.component').then(m => m.InsuranceListComponent) },
      { path: 'insurance/:id', loadComponent: () => import('./features/insurance/insurance-detail/insurance-detail.component').then(m => m.InsuranceDetailComponent) },
      { path: 'reports', loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent) },
      { path: 'users', canActivate: [roleGuard('Administrator')], loadComponent: () => import('./features/users/users.component').then(m => m.UsersComponent) },
      { path: 'audit', canActivate: [roleGuard('Administrator','Operations','Finance')], loadComponent: () => import('./features/audit/audit.component').then(m => m.AuditComponent) },
      { path: 'settings', canActivate: [roleGuard('Administrator')], loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
