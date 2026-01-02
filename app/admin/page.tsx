import Link from 'next/link'

const adminSections = [
  {
    href: '/admin/menu',
    title: 'Menu Management',
    description: 'Manage menu items, prices, and availability',
    icon: '🍽️',
    color: 'from-orange-500/10 to-orange-600/10 border-orange-500/20'
  },
  {
    href: '/admin/categories',
    title: 'Categories',
    description: 'Organize menu items into categories',
    icon: '📁',
    color: 'from-blue-500/10 to-blue-600/10 border-blue-500/20'
  },
  {
    href: '/admin/option-groups',
    title: 'Option Groups',
    description: 'Manage menu options and customizations',
    icon: '⚙️',
    color: 'from-green-500/10 to-green-600/10 border-green-500/20'
  },
  {
    href: '/admin/orders',
    title: 'Orders',
    description: 'View and manage customer orders',
    icon: '📋',
    color: 'from-purple-500/10 to-purple-600/10 border-purple-500/20'
  },
  {
    href: '/admin/menu-data',
    title: 'Import/Export',
    description: 'Bulk import and export menu data',
    icon: '📤',
    color: 'from-yellow-500/10 to-yellow-600/10 border-yellow-500/20'
  }
]

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-bg p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-text mb-2">Admin Dashboard</h1>
          <p className="text-muted">Manage your restaurant operations from here</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map(section => (
            <Link
              key={section.href}
              href={section.href}
              className="group"
            >
              <div className={`h-full p-6 bg-gradient-to-br ${section.color} border rounded-lg transition-all hover:scale-[1.02] hover:shadow-lg cursor-pointer`}>
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{section.icon}</span>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-text mb-1 group-hover:text-primary transition-colors">
                      {section.title}
                    </h2>
                    <p className="text-sm text-muted">
                      {section.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center text-primary text-sm font-medium">
                  Manage
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
