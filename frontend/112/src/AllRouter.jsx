import React from 'react'
import {BrowserRouter as Router , Routes , Route } from "react-router-dom"
import Dashboard from './dashboard'
import Events from './user/events'
import EventDetails from './user/EventDetails' 
import Login from './user/Login'
import Register from './user/Register'
import MyTickets from './user/MyTickets'
import Notifications from './user/Notifications'
import Reservation from './user/Reservation'
import DropPage from './user/DropPage'

import AdminLogin from './admin/AdminLogin'
import AdminLayout from './admin/AdminLayout'
import AdminDashboard from './admin/AdminDashboard'
import AdminDrops from './admin/AdminDrops'
import AdminEvents from './admin/AdminEvents'
import AdminAbuse from './admin/AdminAbuse'
import AdminFairness from './admin/AdminFairness'
import AdminSimulation from './admin/AdminSimulation'
import AdminHealth from './admin/AdminHealth'


const AllRouter = () => {
  return (
    <div>

        <Router>
            <Routes>
                <Route path = '/' element = {<Dashboard/>}/> 
                <Route path = '/events' element = {<Events/>}/> 
                  <Route path="/events/:eventId" element={<EventDetails />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/tickets" element={<MyTickets />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/reservations/:reservationId" element={<Reservation />} />
                  <Route path="/drops/:dropId" element={<DropPage />} />
 
 <Route path="/admin/login" element={<AdminLogin />} />

<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<AdminDashboard />} />
  <Route path="events" element={<AdminEvents />} />
  <Route path="drops" element={<AdminDrops />} />
  <Route path="abuse" element={<AdminAbuse />} />
  <Route path="fairness" element={<AdminFairness />} />
  <Route path="simulation" element={<AdminSimulation />} />
  <Route path="health" element={<AdminHealth />} />
</Route>
                  
            </Routes>
        </Router>
      
    </div>
  )
}

export default AllRouter
