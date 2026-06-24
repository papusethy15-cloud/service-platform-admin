export interface Booking { id:string; booking_number:string; status:string; customer_id:string; technician_id?:string; service_id:string; scheduled_date:string; total_amount:number; priority:string; created_at:string }
export interface Customer { id:string; name:string; mobile:string; email?:string; customer_code?:string; total_bookings?:string; created_at:string }
export interface Technician { id:string; name:string; mobile:string; email?:string; technician_code?:string; city?:string; status:string; rating:number; total_jobs:number; experience_years:number }
export interface Service { id:string; name:string; category_id:string; base_price:number; gst_percent:number; duration_mins:number; is_visible:boolean }
export interface DashboardKPIs { bookings:{total:number;today:number;pending:number;completed_this_month:number}; revenue:{total:number;this_month:number}; customers:{total:number}; technicians:{active:number} }
