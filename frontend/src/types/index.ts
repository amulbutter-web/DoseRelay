// All TypeScript interfaces for DoseRelay

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: 'network_admin' | 'hospital_admin' | 'pharmacist' | 'mto' | 'logistics';
  hospital_id: number | null;
  is_active: boolean;
  created_at?: string;
}

export interface Hospital {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  hospital_type: string;
  bed_count: number;
  status: string;
  total_batches?: number;
  total_medicines?: number;
  expiry_alert_count?: number;
  surplus_count?: number;
  shortage_count?: number;
}

export interface Medicine {
  id: number;
  name: string;
  generic_name: string | null;
  active_ingredient: string | null;
  strength: string | null;
  dosage_form: string;
  category: string | null;
  manufacturer: string | null;
  requires_cold_storage: boolean;
  controlled_substance: boolean;
  created_at?: string;
}

export interface MedicineBatch {
  id: number;
  medicine_id: number;
  hospital_id: number;
  batch_number: string;
  quantity: number;
  reserved_quantity: number;
  manufacturing_date: string | null;
  expiry_date: string;
  unit_price: number | null;
  storage_temp_min: number | null;
  storage_temp_max: number | null;
  status: string;
  created_at?: string;
  medicine_name?: string;
  hospital_name?: string;
}

export interface Transfer {
  id: number;
  recommendation_id: number | null;
  donor_hospital_id: number;
  receiver_hospital_id: number;
  medicine_id: number;
  batch_id: number;
  quantity: number;
  status: string;
  qr_code_token: string | null;
  mto_id: number | null;
  mto_notes: string | null;
  donor_pharmacist_id: number | null;
  donor_approval_at: string | null;
  donor_notes: string | null;
  receiver_pharmacist_id: number | null;
  receiver_approval_at: string | null;
  receiver_notes: string | null;
  logistics_personnel_id: number | null;
  dispatch_date: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  delivery_notes: string | null;
  received_quantity: number | null;
  receipt_verified: boolean;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  donor_hospital_name?: string;
  receiver_hospital_name?: string;
  medicine_name?: string;
  batch_number?: string;
}

export interface TransferRecommendation {
  id: number;
  donor_hospital_id: number;
  receiver_hospital_id: number;
  medicine_id: number;
  batch_id: number;
  recommended_quantity: number;
  reason: string;
  eligibility_notes: string | null;
  warnings: string | null;
  priority: string;
  status: string;
  created_at?: string;
  donor_hospital_name?: string;
  receiver_hospital_name?: string;
  medicine_name?: string;
  batch_number?: string;
  expiry_date?: string;
}

export interface DemandForecast {
  id: number;
  hospital_id: number;
  medicine_id: number;
  forecast_date: string;
  forecasted_quantity: number;
  lower_bound: number | null;
  upper_bound: number | null;
  model_used: string | null;
  mae: number | null;
  rmse: number | null;
}

export interface ForecastSummary {
  hospital_id: number;
  hospital_name: string;
  medicine_id: number;
  medicine_name: string;
  avg_daily_consumption: number;
  forecasted_30d_demand: number;
  current_stock: number;
  days_of_cover: number;
  stockout_risk: string;
  model_used: string;
  mae?: number;
  rmse?: number;
}

export interface ConsumptionRecord {
  id: number;
  hospital_id: number;
  medicine_id: number;
  date: string;
  quantity_consumed: number;
}

export interface DashboardStats {
  total_hospitals: number;
  total_medicines: number;
  total_batches: number;
  hospitals_with_shortages: number;
  hospitals_with_surplus: number;
  approaching_expiry: number;
  pending_transfers: number;
  completed_transfers: number;
  recent_activities: Activity[];
}

export interface Activity {
  id: number;
  action: string;
  entity_type: string | null;
  details: string | null;
  created_at: string | null;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export interface SurplusShortageItem {
  hospital_id: number;
  hospital_name: string;
  medicine_id: number;
  medicine_name: string;
  available_stock: number;
  avg_daily_consumption: number;
  days_of_cover: number;
  forecast_demand: number;
  safety_stock: number;
  surplus: number;
  shortage: number;
  reason: string;
}

export interface AnalyticsData {
  total_completed_transfers: number;
  total_quantity_redistributed: number;
  shortages_addressed: number;
  expiry_stock_saved: number;
  estimated_value_preserved: number;
  avg_completion_time_hours: number;
  transfer_trends: { label: string; value: number }[];
  category_distribution: { label: string; value: number }[];
  hospital_activity: { hospital: string; sent: number; received: number }[];
}

export interface ExpiryAlert {
  batch_id: number;
  batch_number: string;
  medicine_id: number;
  medicine_name: string;
  hospital_id: number;
  hospital_name: string;
  quantity: number;
  expiry_date: string;
  days_remaining: number;
  status: string;
}
