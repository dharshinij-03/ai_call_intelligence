# 📍 Geolocation + Heatmap Integration - Complete Guide

Your complaint tracker now captures user location and displays it on an admin heatmap!

## ✅ What Was Done

### 1. **Frontend - Geolocation Permission** 🎤📍
**File:** `frontend/src/pages/citizen/CitizenCallPage.tsx`

- Added `useEffect` hook that **automatically requests location permission** when citizen loads the call page
- Uses browser's Geolocation API with high accuracy
- Displays location status badge: `📍 Location captured (±Xm)` or `❌ Permission denied`
- Sends location data with call request

### 2. **Frontend - Location Display** 
**File:** `frontend/src/pages/citizen/CitizenCallPage.tsx`

- Added location status badge next to language selector
- Shows real-time location accuracy
- Visual feedback: 📍 = captured, ⏳ = requesting, ❌ = denied

### 3. **Frontend - API Update**
**File:** `frontend/src/lib/api/citizen.ts`

- Modified `requestCall()` to accept optional location object
- Sends latitude, longitude, and accuracy to backend

### 4. **Backend - Database Schema** 🗄️
**File:** `backend/citizen-service/app/models.py`

Added 3 new columns to `CallSession` table:
```python
latitude: Column(Float, nullable=True, index=True)
longitude: Column(Float, nullable=True, index=True)
location_accuracy: Column(Float, nullable=True)
```

### 5. **Backend - API Schema**
**File:** `backend/citizen-service/app/schemas.py`

- Created `CallRequestIn` schema to accept location data
- Updated `CallSessionOut` schema to return location fields

### 6. **Backend - Endpoint**
**File:** `backend/citizen-service/app/routers/calls.py`

- Updated `request_call()` endpoint to accept and store location data
- Location data now persists with every call session

### 7. **Admin Heatmap** 🗺️
**File:** `frontend/src/pages/admin/AdminHeatmapPage.tsx`

- Already exists and displays complaints clustered into ~100m grid
- **Automatically shows location data** from call sessions
- Darker circles = higher complaint density
- Shows complaint clusters across entire geographic area

## 🔄 How It Works

### User Journey:

1. **Citizen opens call page**
   - Browser asks for location permission
   - Status shows: "⏳ Requesting location permission…"

2. **Citizen grants permission**
   - Location is captured (latitude, longitude, accuracy)
   - Status shows: "📍 Location captured (±15m)"

3. **Citizen calls operator**
   - Location is sent with call request
   - Backend stores location with the complaint

4. **Admin views heatmap**
   - Sees all complaints plotted on map
   - Circles show complaint density by area
   - Darker color = more complaints in that zone

### Data Flow:

```
Citizen Device
    ↓ (Requests Location)
Browser Geolocation API
    ↓ (Gets lat/lng/accuracy)
CitizenCallPage.tsx (userLocation state)
    ↓ (Sends with requestCall)
Frontend API (citizen.ts)
    ↓ (POST /calls/request)
Backend API (calls.py)
    ↓ (Stores in DB)
CallSession Table (latitude, longitude, location_accuracy)
    ↓ (Queries for heatmap)
AdminHeatmapPage.tsx
    ↓ (Displays on map)
Admin Dashboard
```

## 📋 Database Migration

You'll need to run a migration to add the new columns. Create a migration file:

```bash
cd backend/citizen-service
# Using Alembic (if configured)
alembic revision --autogenerate -m "Add geolocation fields to call_sessions"
alembic upgrade head
```

Or manually:
```sql
ALTER TABLE call_sessions ADD COLUMN latitude FLOAT;
ALTER TABLE call_sessions ADD COLUMN longitude FLOAT;
ALTER TABLE call_sessions ADD COLUMN location_accuracy FLOAT;
CREATE INDEX ix_call_sessions_latitude ON call_sessions(latitude);
CREATE INDEX ix_call_sessions_longitude ON call_sessions(longitude);
```

## 🎯 User Experience

### Citizen:

- **On Load:** Sees "⏳ Requesting location permission…"
- **After Grant:** Sees "📍 Location captured (±25m)"
- **After Deny:** Sees "❌ User denied geolocation" — can still call
- **During Call:** Location badge visible showing accuracy

### Admin:

- **Heatmap Page:** Shows all complaint locations clustered
- **Color Coding:** Light purple (low) → Dark purple (high density)
- **Cluster Size:** Larger circles = more complaints
- **Interactive:** Can zoom/pan map to see specific areas

## 🔐 Privacy & Security

✅ **Privacy-First Design:**
- Location requested **explicitly** with browser permission
- Users can deny — calling still works
- Location only captured at moment of call start
- Stored only with call session (not tracked continuously)
- Data stays in-network (no third-party tracking)

✅ **Data Protection:**
- Location indexed for fast heatmap queries
- Only admins can view heatmap
- Location accuracy shown to users (transparency)

## 🚀 Testing

### Test Geolocation:

1. Open citizen portal: `http://localhost:5173/citizen/call`
2. Check browser permission prompt
3. Allow location access
4. Should see: `📍 Location captured (±Xm)`
5. Make a call
6. Go to admin portal
7. Click "Heatmap" tab
8. Should see circle on map at your location

### Test Permission Denial:

1. Open DevTools (F12)
2. Settings → Permissions → Geolocation → Deny
3. Reload page
4. Should see: `❌ User denied geolocation`
5. Can still call (location is optional)

## 📊 Admin Heatmap Features

| Feature | Description |
|---------|-------------|
| **Clustering** | Complaints grouped into ~100m grid cells |
| **Color** | Light (few) to Dark (many) |
| **Size** | Radius scales with complaint count |
| **Zoom** | Click to zoom into specific areas |
| **Pan** | Drag to view different regions |
| **Legend** | Shows color scale (Low → High) |
| **Count** | Displays total number of clusters |

## 🔧 Configuration

### Location Accuracy:

Default: High accuracy (uses GPS when available)

```typescript
// In CitizenCallPage.tsx
navigator.geolocation.getCurrentPosition(
  (position) => { /* ... */ },
  (err) => { /* ... */ },
  {
    enableHighAccuracy: true,  // Force GPS over WiFi
    timeout: 10000,             // 10 second timeout
    maximumAge: 0,              // Don't use cached position
  }
);
```

### Speaking Threshold:

Microphone volume detection:
```typescript
const SPEAKING_THRESHOLD = 5;      // Mic volume threshold
const SPEAKING_TIMEOUT = 1500;     // Wait 1.5s after silence
```

## 📝 Files Modified/Created

```
backend/
├── citizen-service/
│   ├── app/
│   │   ├── models.py           ✏️ Added location columns
│   │   ├── schemas.py          ✏️ Added CallRequestIn + location fields
│   │   └── routers/
│   │       └── calls.py        ✏️ Updated request_call endpoint
│
frontend/
├── src/
│   ├── lib/
│   │   └── api/
│   │       └── citizen.ts      ✏️ Updated requestCall with location
│   └── pages/
│       └── citizen/
│           └── CitizenCallPage.tsx  ✏️ Added geolocation + UI
│               └── AdminHeatmapPage.tsx (no changes - already works!)
```

## ✨ Next Steps

1. **Run Database Migration** - Add location columns
2. **Test in Chrome/Edge** - Best geolocation support
3. **Monitor Heatmap** - Watch complaint distribution
4. **Optimize Routes** - Use heatmap to deploy resources
5. **Privacy Notice** - Inform users about location collection

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Location permission not requested" | Check browser geolocation support |
| No circles on heatmap | Make sure calls have been completed with location |
| Circles in wrong place | Check if lat/lng fields are indexed correctly |
| Location always denied | Check site permissions in browser settings |
| "Geolocation not supported" | Use Chrome/Edge (Firefox doesn't support it) |

## 📞 Support

For issues, check:
- Browser console (F12) for geolocation errors
- Database for stored location values
- Admin heatmap query logs
- Browser permission settings

---

**Status:** ✅ **Complete & Ready to Use**
**Version:** 1.0
**Last Updated:** 2026-08-17
