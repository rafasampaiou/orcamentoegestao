import { supabase } from './supabaseClient';
import { Account, CostCenter, Hotel, BudgetVersion, User, GMDConfiguration, UserRole, ImportedRow } from '../types';

export const supabaseService = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNTS (Contas Contábeis)
  // ═══════════════════════════════════════════════════════════════════════════
  async getAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .order('sortOrder', { ascending: true });
    if (error) throw error;
    return (data || []) as Account[];
  },

  async upsertAccounts(accounts: Account[]): Promise<void> {
    const records = accounts.map(a => ({
      id: a.id,
      code: a.code || a.id,
      name: a.name,
      level: a.level || 'account',
      package: a.package,
      packageCode: a.packageCode,
      masterPackage: a.masterPackage,
      masterPackageCode: a.masterPackageCode,
      packageId: a.packageId,
      type: a.type || 'Fixed',
      sortOrder: a.sortOrder || 0,
      outOfScope: a.outOfScope || false,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('accounts')
      .upsert(records, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COST CENTERS (Setores / CR / PDV)
  // ═══════════════════════════════════════════════════════════════════════════
  async getCostCenters(): Promise<CostCenter[]> {
    const { data, error } = await supabase
      .from('cost_centers')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;

    return (data || []).map(cc => ({
      id: cc.id,
      code: cc.code || cc.id,
      name: cc.name,
      type: cc.type,
      directorate: cc.directorate,
      department: cc.department,
      hotelName: cc.hotel_name,
      hierarchicalCode: cc.hierarchical_code,
      companyCode: cc.company_code
    })) as CostCenter[];
  },

  async upsertCostCenters(costCenters: CostCenter[]): Promise<void> {
    const records = costCenters.map(cc => ({
      id: cc.id,
      code: cc.code || cc.id,
      name: cc.name,
      type: cc.type,
      directorate: cc.directorate,
      department: cc.department,
      hotel_name: cc.hotelName,
      hierarchical_code: cc.hierarchicalCode,
      company_code: cc.companyCode,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('cost_centers')
      .upsert(records, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteCostCenter(id: string): Promise<void> {
    const { error } = await supabase
      .from('cost_centers')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // HOTELS (Unidades)
  // ═══════════════════════════════════════════════════════════════════════════
  async getHotels(): Promise<Hotel[]> {
    const { data, error } = await supabase
      .from('hotels')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as Hotel[];
  },

  async upsertHotels(hotels: Hotel[]): Promise<void> {
    const records = hotels.map(h => ({
      id: h.id,
      name: h.name,
      code: h.code,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('hotels')
      .upsert(records, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteHotel(id: string): Promise<void> {
    const { error } = await supabase
      .from('hotels')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET DATA (Valores do Orçamento)
  // ═══════════════════════════════════════════════════════════════════════════
  async getBudgetData(accountId: string, costCenterId: string, year: number): Promise<number[]> {
    const { data, error } = await supabase
      .from('budget_data')
      .select('month, value')
      .eq('account_id', accountId)
      .eq('cost_center_id', costCenterId)
      .eq('year', year);
    if (error) throw error;

    const values = Array(12).fill(0);
    data?.forEach(row => {
      if (row.month >= 1 && row.month <= 12) {
        values[row.month - 1] = row.value;
      }
    });
    return values;
  },

  async saveBudgetData(accountId: string, costCenterId: string, year: number, values: number[]) {
    const records = values.map((val, idx) => ({
      account_id: accountId,
      cost_center_id: costCenterId,
      year: year,
      month: idx + 1,
      value: val,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('budget_data')
      .upsert(records, { onConflict: 'account_id,cost_center_id,year,month' });
    if (error) throw error;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BUDGET VERSIONS (Versões de Orçamento)
  // ═══════════════════════════════════════════════════════════════════════════
  async getBudgetVersions(): Promise<BudgetVersion[]> {
    const { data, error } = await supabase
      .from('budget_versions')
      .select('*')
      .order('year', { ascending: false });
    if (error) throw error;

    return (data || []).map(v => ({
      id: v.id,
      name: v.name,
      year: v.year,
      month: v.month,
      isLocked: v.is_locked,
      isMain: v.is_main,
      createdAt: v.created_at,
      updatedAt: v.updated_at
    })) as BudgetVersion[];
  },

  async upsertBudgetVersion(version: BudgetVersion): Promise<void> {
    const record = {
      id: version.id,
      name: version.name,
      year: version.year,
      month: version.month || 1,
      is_locked: version.isLocked,
      is_main: version.isMain,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('budget_versions')
      .upsert(record, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteBudgetVersion(id: string): Promise<void> {
    const { error } = await supabase
      .from('budget_versions')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILES (Usuários do sistema)
  // ═══════════════════════════════════════════════════════════════════════════
  async getProfiles(): Promise<User[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) throw error;

    return (data || []).map(p => ({
      id: p.id,
      name: p.full_name || '',
      email: p.email || '',
      role: (p.role || 'Gestor de Pacote') as UserRole,
      hotelId: p.hotel_id || undefined,
      tempPassword: p.temp_password || undefined
    })) as User[];
  },

  async upsertProfile(user: User): Promise<void> {
    const record = {
      id: user.id,
      full_name: user.name,
      email: user.email,
      role: user.role,
      hotel_id: user.hotelId || null,
      temp_password: user.tempPassword || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(record, { onConflict: 'id' });
    if (error) throw error;
  },

  async adminSaveProfile(user: User): Promise<string> {
      const { data, error } = await supabase.rpc('admin_save_user', {
          p_id: user.id,
          p_email: user.email,
          p_password: user.tempPassword || '',
          p_name: user.name,
          p_role: user.role,
          p_hotel_id: user.hotelId || null,
          p_can_admin: true,
          p_can_geral: true,
          p_can_cadastros: true
      });
      
      if (error) throw error;
      return data as string; // UUID of the user
  },

  async deleteProfile(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GMD CONFIGURATIONS (Matriz de Gestão por conta)
  // ═══════════════════════════════════════════════════════════════════════════
  async getGmdConfigs(): Promise<GMDConfiguration[]> {
    const { data, error } = await supabase
      .from('gmd_configurations')
      .select('*');
    if (error) throw error;

    return (data || []).map(g => ({
      id: g.id,
      hotelId: g.hotel_id || '',
      packageId: g.package_id || '',
      packageManagerId: g.package_manager_id || '',
      costCenterId: g.cost_center_id || '',
      accountManagerId: g.account_manager_id || '',
      entityManagerIds: g.entity_manager_ids || [],
      supportUserIds: g.support_user_ids || [],
      linkedAccountIds: g.linked_account_ids || []
    })) as GMDConfiguration[];
  },

  async upsertGmdConfig(gmd: GMDConfiguration): Promise<void> {
    const record = {
      id: gmd.id,
      hotel_id: gmd.hotelId,
      package_id: gmd.packageId,
      package_manager_id: gmd.packageManagerId,
      cost_center_id: gmd.costCenterId,
      account_manager_id: gmd.accountManagerId,
      entity_manager_ids: gmd.entityManagerIds,
      support_user_ids: gmd.supportUserIds,
      linked_account_ids: gmd.linkedAccountIds,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('gmd_configurations')
      .upsert(record, { onConflict: 'id' });
    if (error) throw error;
  },

  async deleteGmdConfig(id: string): Promise<void> {
    const { error } = await supabase
      .from('gmd_configurations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCIAL DATA (Dados Financeiros Reais e de Orçamento)
  // ═══════════════════════════════════════════════════════════════════════════
  async saveFinancialData(rows: ImportedRow[]): Promise<void> {
    if (rows.length === 0) return;
    const records = rows.map(r => ({
      version_id:    r.versionId || null,
      year:          parseInt(r.ano) || new Date().getFullYear(),
      month:         parseInt(r.mes) || 1,
      scenario:      r.cenario,
      real_meta:     r.cenario,           // 'Real' or 'Meta'
      hotel:         r.hotel,
      account_name:  r.conta,
      cost_center:   r.cr,
      value:         parseFloat(r.valor) || 0,
      type:          r.tipo || '',
      scope:         r.escopo || null,
      department:    r.departamento || null,
      package:       r.pacote || null,
      master_package: r.pacoteMaster || null,
      cr:            r.cr || null,
      conta_contabil: (r as any).contaContabil || null,
    }));

    // Save in batches of 500 to avoid payload limits
    const batchSize = 500;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const { error } = await supabase
        .from('financial_data')
        .insert(batch);
      if (error) throw error;
    }
  },

  async deleteFinancialDataByVersion(versionId: string): Promise<void> {
    const { error } = await supabase
      .from('financial_data')
      .delete()
      .eq('version_id', versionId);
    if (error) throw error;
  },

  async getFinancialDataByVersion(versionId: string): Promise<ImportedRow[]> {
    const { data, error } = await supabase
      .from('financial_data')
      .select('*')
      .eq('version_id', versionId);
    if (error) throw error;
    return (data || []).map(r => ({
      ano:          String(r.year),
      cenario:      r.scenario,
      tipo:         r.type || '',
      hotel:        r.hotel,
      conta:        r.account_name,
      cr:           r.cost_center || '',
      mes:          String(r.month),
      valor:        String(r.value || '0'),
      escopo:       r.scope || '',
      departamento: r.department || '',
      pacote:       r.package || '',
      pacoteMaster: r.master_package || '',
      diretoria:    r.directorate || '',
      versionId:    r.version_id || '',
      status:       'valid' as const,
    }));
  },
};
