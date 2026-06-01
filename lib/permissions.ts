export type RoleName = 'owner' | 'manager' | 'solicitor' | 'receptionist' | 'administrator'

export interface Permissions {
  canViewBilling: boolean
  canViewReports: boolean
  canViewAllLeads: boolean
  canViewAllCalls: boolean
  canManageStaff: boolean
  canManageSettings: boolean
  canDeleteLeads: boolean
  canPermanentlyDeleteLeads: boolean
  canViewKnowledgeBase: boolean
}

export function getPermissions(role: RoleName): Permissions {
  switch (role) {
    case 'owner':
      return {
        canViewBilling: true,
        canViewReports: true,
        canViewAllLeads: true,
        canViewAllCalls: true,
        canManageStaff: true,
        canManageSettings: true,
        canDeleteLeads: true,
        canPermanentlyDeleteLeads: true,
        canViewKnowledgeBase: true,
      }
    case 'manager':
      return {
        canViewBilling: false,
        canViewReports: true,
        canViewAllLeads: true,
        canViewAllCalls: true,
        canManageStaff: true,
        canManageSettings: true,
        canDeleteLeads: true,
        canPermanentlyDeleteLeads: false,
        canViewKnowledgeBase: true,
      }
    case 'administrator':
      return {
        canViewBilling: false,
        canViewReports: false,
        canViewAllLeads: true,
        canViewAllCalls: true,
        canManageStaff: true,
        canManageSettings: true,
        canDeleteLeads: false,
        canPermanentlyDeleteLeads: false,
        canViewKnowledgeBase: true,
      }
    case 'receptionist':
      return {
        canViewBilling: false,
        canViewReports: false,
        canViewAllLeads: true,
        canViewAllCalls: true,
        canManageStaff: false,
        canManageSettings: false,
        canDeleteLeads: true,
        canPermanentlyDeleteLeads: false,
        canViewKnowledgeBase: false,
      }
    case 'solicitor':
      return {
        canViewBilling: false,
        canViewReports: false,
        canViewAllLeads: false, // assigned only
        canViewAllCalls: false, // assigned only
        canManageStaff: false,
        canManageSettings: false,
        canDeleteLeads: false,
        canPermanentlyDeleteLeads: false,
        canViewKnowledgeBase: false,
      }
    default:
      return {
        canViewBilling: false,
        canViewReports: false,
        canViewAllLeads: true,
        canViewAllCalls: true,
        canManageStaff: false,
        canManageSettings: false,
        canDeleteLeads: false,
        canPermanentlyDeleteLeads: false,
        canViewKnowledgeBase: false,
      }
  }
}
