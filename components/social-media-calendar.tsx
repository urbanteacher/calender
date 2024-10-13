'use client'

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Calendar, momentLocalizer, Views } from 'react-big-calendar'
import moment from 'moment'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar as CalendarIcon, Trash2, Edit, Plus, Link, MessageSquare, Clock, Gift, Cake, Utensils, Globe, Plane, Book, Heart, CreditCard, Briefcase, Users, Home, MoreHorizontal, Search, Filter, Check, BarChart2, TrendingUp, Share2, Info, Download, Upload } from 'lucide-react'
import { RRule, RRuleSet, rrulestr } from 'rrule'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createEvents } from 'ics'

const localizer = momentLocalizer(moment)

// Define types for events, public events, and personal calendars
type EventCategory = 'personal' | 'family' | 'work' | 'other'

type Event = {
  id?: number
  title: string
  start: Date
  end: Date
  type: 'post' | 'birthday' | 'anniversary' | 'eatout' | 'meeting' | 'worlddates' | 'holiday' | 'study' | 'hobby' | 'payment'
  category: EventCategory
  location?: string
  webLink?: string
}

type PublicEvent = {
  id: number
  title: string
  date: Date
  source: string
  type: Event['type']
  location?: string
  webLink?: string
  dateAdded: Date
}

type PersonalCalendar = {
  id: number
  name: string
  color: string
}

// Sample public events data
const publicEvents: PublicEvent[] = [
  { 
    id: 1, 
    title: "Tech Conference", 
    date: new Date(2024, 9, 15, 9, 0), 
    source: "TechEvents", 
    type: 'post',
    location: "San Francisco, CA",
    webLink: "https://techconference.com",
    dateAdded: new Date(2024, 8, 1)
  },
  { 
    id: 2, 
    title: "Social Media Day", 
    date: new Date(2024, 9, 16, 10, 30), 
    source: "GlobalDays", 
    type: 'post',
    dateAdded: new Date(2024, 8, 5)
  },
  // Liverpool FC events
  {
    id: 3,
    title: "Liverpool vs Manchester United",
    date: new Date(2024, 9, 20, 15, 0),
    source: "Liverpool FC",
    type: 'post',
    location: "Anfield, Liverpool",
    webLink: "https://www.liverpoolfc.com/match/2024-25/men/fixtures-results",
    dateAdded: new Date(2024, 8, 10)
  },
  {
    id: 4,
    title: "Liverpool vs Everton",
    date: new Date(2024, 10, 5, 15, 0),
    source: "Liverpool FC",
    type: 'post',
    location: "Anfield, Liverpool",
    webLink: "https://www.liverpoolfc.com/match/2024-25/men/fixtures-results",
    dateAdded: new Date(2024, 8, 15)
  },
  {
    id: 5,
    title: "Arsenal vs Liverpool",
    date: new Date(2024, 10, 12, 17, 30),
    source: "Liverpool FC",
    type: 'post',
    location: "Emirates Stadium, London",
    webLink: "https://www.liverpoolfc.com/match/2024-25/men/fixtures-results",
    dateAdded: new Date(2024, 8, 20)
  }
  // Add more events as needed
]

interface TooltipProps {
  content: string;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute z-10 px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg shadow-sm tooltip dark:bg-gray-700">
          {content}
        </div>
      )}
    </div>
  );
};

// Helper function to sort events
const sortEventsByDate = (a: Event | PublicEvent, b: Event | PublicEvent) => {
  const dateA = 'start' in a ? a.start : a.date;
  const dateB = 'start' in b ? b.start : b.date;
  const now = new Date();
  
  // If both dates are in the future or both in the past, sort in reverse chronological order
  if ((dateA >= now && dateB >= now) || (dateA < now && dateB < now)) {
    return dateB.getTime() - dateA.getTime();
  }
  
  // If one is in the future and one in the past, prioritize the future one
  return dateA >= now ? -1 : 1;
};

export default function SocialMediaCalendar() {
  // State declarations
  const [events, setEvents] = useState<Event[]>([])
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [isAddingEvent, setIsAddingEvent] = useState(false)
  const [newEvent, setNewEvent] = useState<Partial<Event>>({
    title: '',
    start: new Date(),
    end: new Date(),
    type: 'post',
    category: 'personal'
  })
  const [view, setView] = useState(Views.MONTH)
  const [date, setDate] = useState(new Date())
  const [personalCalendars, setPersonalCalendars] = useState<PersonalCalendar[]>([
    { id: 1, name: "Work", color: "#2196F3" },
    { id: 2, name: "Personal", color: "#4CAF50" },
    { id: 3, name: "Family", color: "#FF9800" },
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<Event['type'] | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<EventCategory | 'all'>('all')
  const [followedCalendars, setFollowedCalendars] = useState([
    { id: 1, name: "Liverpool FC", followed: true },
    { id: 2, name: "TechEvents", followed: true },
    { id: 3, name: "GlobalDays", followed: true },
  ])
  const [editingCalendar, setEditingCalendar] = useState<PersonalCalendar | null>(null)

  // Add this new state for public calendar filter
  const [filterPublicCalendar, setFilterPublicCalendar] = useState<string>('all')

  // Event handlers
  const handleSelectEvent = (event: Event) => {
    if (!event.source) {
      setSelectedEvent(event);
    }
  }

  const handleSelectSlot = ({ start, end }: { start: Date; end: Date }) => {
    const newEvent: Partial<Event> = {
      title: '',
      start,
      end,
      type: 'post',
      category: 'personal'
    };
    setSelectedEvent(newEvent as Event);
  };

  const handleAddEvent = () => {
    if (newEvent.title && newEvent.start && newEvent.end && newEvent.type && newEvent.category) {
      const eventToAdd: Event = {
        ...newEvent as Event,
        id: Date.now()
      }

      if (newEvent.recurrence) {
        eventToAdd.recurrence = newEvent.recurrence
      }

      setEvents([...events, eventToAdd])
      setIsAddingEvent(false)
      setNewEvent({ title: '', start: new Date(), end: new Date(), type: 'post', category: 'personal' })
    }
  }

  const handleUpdateEvent = () => {
    if (selectedEvent) {
      setEvents(events.map(event => event.id === selectedEvent.id ? selectedEvent : event))
      setSelectedEvent(null)
    }
  }

  const handleDeleteEvent = (id: number) => {
    setEvents(prevEvents => prevEvents.filter(event => event.id !== id));
    setSelectedEvent(null);
  };

  const handleLinkPublicEvent = useCallback((publicEvent: PublicEvent) => {
    const existingEvent = events.find(event => 
      event.title === publicEvent.title && 
      event.start.getTime() === publicEvent.date.getTime() &&
      event.source === publicEvent.source
    )

    if (!existingEvent) {
      const newLinkedEvent: Event = {
        id: Date.now(),
        title: publicEvent.title,
        start: publicEvent.date,
        end: new Date(publicEvent.date.getTime() + 60 * 60 * 1000), // Default to 1 hour duration
        type: publicEvent.type,
        category: 'other',
        source: publicEvent.source
      }
      setEvents(prevEvents => [...prevEvents, newLinkedEvent])
    }
  }, [events, setEvents])

  const handleToggleFollowCalendar = (calendarId: number) => {
    setFollowedCalendars(prevCalendars => 
      prevCalendars.map(calendar => 
        calendar.id === calendarId ? { ...calendar, followed: !calendar.followed } : calendar
      )
    )
  }

  // useEffect for filtering events based on followed calendars
  useEffect(() => {
    const followedSources = followedCalendars.filter(cal => cal.followed).map(cal => cal.name)
    setEvents(prevEvents => prevEvents.filter(event => !event.source || followedSources.includes(event.source)))
    
    // Reset the public calendar filter if the currently selected calendar is unfollowed
    if (filterPublicCalendar !== 'all' && !followedSources.includes(filterPublicCalendar)) {
      setFilterPublicCalendar('all')
    }
  }, [followedCalendars])

  // Helper functions
  const expandRecurringEvents = useCallback((events: Event[]) => {
    const expandedEvents: Event[] = []
    events.forEach(event => {
      if (event.recurrence) {
        const rule = rrulestr(event.recurrence)
        const occurrences = rule.between(new Date(), new Date(new Date().getFullYear() + 1, 0, 1))
        occurrences.forEach((date, index) => {
          expandedEvents.push({
            ...event,
            id: event.id + index,
            start: date,
            end: new Date(date.getTime() + (event.end.getTime() - event.start.getTime()))
          })
        })
      } else {
        expandedEvents.push(event)
      }
    })
    return expandedEvents
  }, [])

  // Memoized filtered events
  const filteredEvents = useMemo(() => {
    const filtered = events.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || event.type === filterType;
      const matchesCategory = filterCategory === 'all' || event.category === filterCategory;
      const matchesPublicCalendar = filterPublicCalendar === 'all' 
        ? true 
        : event.source === filterPublicCalendar || (!event.source && filterPublicCalendar === 'personal');
      return matchesSearch && matchesType && matchesCategory && matchesPublicCalendar;
    });
    return expandRecurringEvents(filtered);
  }, [events, searchTerm, filterType, filterCategory, filterPublicCalendar, expandRecurringEvents])

  const eventStyleGetter = (event: Event) => {
    const calendar = personalCalendars.find(cal => cal.name.toLowerCase() === event.category)
    const backgroundColor = event.source ? '#C8102E' : (calendar ? calendar.color : '#3174ad')
    return { 
      style: { backgroundColor },
    }
  }

  const getEventTypeIcon = (type: Event['type']) => {
    switch(type) {
      case 'post': return <MessageSquare className="inline-block mr-2" size={16} />
      case 'birthday': return <Cake className="inline-block mr-2" size={16} />
      case 'anniversary': return <Gift className="inline-block mr-2" size={16} />
      case 'eatout': return <Utensils className="inline-block mr-2" size={16} />
      case 'meeting': return <Clock className="inline-block mr-2" size={16} />
      case 'worlddates': return <Globe className="inline-block mr-2" size={16} />
      case 'holiday': return <Plane className="inline-block mr-2" size={16} />
      case 'study': return <Book className="inline-block mr-2" size={16} />
      case 'hobby': return <Heart className="inline-block mr-2" size={16} />
      case 'payment': return <CreditCard className="inline-block mr-2" size={16} />
      default: return <CalendarIcon className="inline-block mr-2" size={16} />
    }
  }

  const getCategoryIcon = (category: EventCategory) => {
    switch(category) {
      case 'personal': return <Users className="inline-block mr-2" size={16} />
      case 'family': return <Home className="inline-block mr-2" size={16} />
      case 'work': return <Briefcase className="inline-block mr-2" size={16} />
      default: return <MoreHorizontal className="inline-block mr-2" size={16} />
    }
  }

  const onView = useCallback((newView: any) => setView(newView), [setView])

  const onNavigate = useCallback((newDate: Date) => setDate(newDate), [setDate])

  const handleAddPersonalCalendar = () => {
    const newCalendarName = prompt("Enter the name for your new calendar:")
    if (newCalendarName) {
      const newCalendar: PersonalCalendar = {
        id: Date.now(),
        name: newCalendarName,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`
      }
      setPersonalCalendars([...personalCalendars, newCalendar])
    }
  }

  const handleEditPersonalCalendar = (calendar: PersonalCalendar) => {
    setEditingCalendar(calendar)
  }

  const handleUpdatePersonalCalendar = () => {
    if (editingCalendar) {
      setPersonalCalendars(prevCalendars =>
        prevCalendars.map(cal =>
          cal.id === editingCalendar.id ? editingCalendar : cal
        )
      )
      setEditingCalendar(null)
    }
  }

  const handleDeletePersonalCalendar = (id: number) => {
    setPersonalCalendars(prevCalendars =>
      prevCalendars.filter(cal => cal.id !== id)
    )
  }

  const groupedPublicEvents = useMemo(() => {
    return publicEvents.reduce((acc, event) => {
      if (!acc[event.source]) {
        acc[event.source] = [];
      }
      acc[event.source].push(event);
      return acc;
    }, {} as Record<string, PublicEvent[]>);
  }, [publicEvents]);

  const filteredGroupedPublicEvents = useMemo(() => {
    const followedSources = followedCalendars
      .filter(cal => cal.followed)
      .map(cal => cal.name);

    return publicEvents.filter(event => followedSources.includes(event.source));
  }, [publicEvents, followedCalendars]);

  // New function to get the next upcoming event
  const getNextEvent = () => {
    const now = new Date()
    return filteredEvents
      .filter(event => event.start > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0]
  }

  // New function to count events by category
  const countEventsByCategory = () => {
    return filteredEvents.reduce((acc, event) => {
      acc[event.category] = (acc[event.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  // Corrected function to get the most active category
  const getMostActiveCategory = () => {
    const categoryCounts = countEventsByCategory()
    return Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  }

  // Corrected function to get the busiest day
  const getBusiestDay = () => {
    const eventsByDay = filteredEvents.reduce((acc, event) => {
      const day = moment(event.start).format('dddd')
      acc[day] = (acc[day] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    return Object.entries(eventsByDay).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'
  }

  const getSourceColor = (source: string) => {
    switch(source) {
      case 'Liverpool FC':
        return '#C8102E'  // Liverpool red
      case 'TechEvents':
        return '#C8102E'  // Tech blue
      case 'GlobalDays':
        return '#C8102E'  // Global green
      default:
        return '#FBBC05'  // Default yellow
    }
  }

  const handleDeletePublicEvent = (id: number) => {
    // This should remove the event from the public events list
    // You might need to update this based on how you're managing public events
    setPublicEvents(prevEvents => prevEvents.filter(event => event.id !== id));
  };

  const handleSaveEvent = () => {
    if (selectedEvent.id) {
      // Update existing event
      setEvents(prevEvents => prevEvents.map(event => 
        event.id === selectedEvent.id ? selectedEvent : event
      ));
    } else {
      // Add new event
      const newEvent = { ...selectedEvent, id: Date.now() };
      setEvents(prevEvents => [...prevEvents, newEvent]);
    }
    setSelectedEvent(null);
  };

  const handleShareEvent = (event: Event) => {
    const isPrivateEvent = ['personal', 'work', 'family'].includes(event.category.toLowerCase());
    if (!isPrivateEvent) {
      // Implement your sharing logic here
      console.log('Sharing event:', event);
      // This could open a modal with sharing options, or trigger some other sharing mechanism
    }
  };

  const [likedEvents, setLikedEvents] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Load liked events from localStorage on component mount
    const storedLikedEvents = localStorage.getItem('likedEvents')
    if (storedLikedEvents) {
      setLikedEvents(new Set(JSON.parse(storedLikedEvents)))
    }
  }, [])

  const handleLikeEvent = (eventId: number) => {
    setLikedEvents(prev => {
      const newLiked = new Set(prev)
      if (newLiked.has(eventId)) {
        newLiked.delete(eventId)
      } else {
        newLiked.add(eventId)
      }
      // Store updated liked events in localStorage
      localStorage.setItem('likedEvents', JSON.stringify([...newLiked]))
      return newLiked
    })
  }

  const handleShareCalendar = (calendarId: number) => {
    // Implement your sharing logic here
    console.log('Sharing calendar:', calendarId)
    // This could open a modal with sharing options, or trigger some other sharing mechanism
  }

  const handleDownloadICS = () => {
    const icsEvents = filteredEvents.map(event => ({
      start: [
        event.start.getFullYear(),
        event.start.getMonth() + 1,
        event.start.getDate(),
        event.start.getHours(),
        event.start.getMinutes()
      ],
      end: [
        event.end.getFullYear(),
        event.end.getMonth() + 1,
        event.end.getDate(),
        event.end.getHours(),
        event.end.getMinutes()
      ],
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      categories: [event.category],
      status: 'CONFIRMED',
      busyStatus: 'BUSY',
      organizer: { name: 'Your Name', email: 'your@email.com' }
    }))

    createEvents(icsEvents, (error, value) => {
      if (error) {
        console.log(error)
        return
      }

      const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.setAttribute('download', 'calendar.ics')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    })
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const lines = content.split('\n')
        const newEvents: Event[] = lines.slice(1).map((line, index) => {
          const [title, startDate, endDate, type, category] = line.split(',')
          return {
            id: Date.now() + index,
            title: title?.trim() || 'Untitled Event',
            start: new Date(startDate?.trim() || Date.now()),
            end: new Date(endDate?.trim() || Date.now()),
            type: (type?.trim() as Event['type']) || 'post',
            category: (category?.trim() as EventCategory) || 'personal'
          }
        }).filter(event => event.title && !isNaN(event.start.getTime()) && !isNaN(event.end.getTime()))
        setEvents(prevEvents => [...prevEvents, ...newEvents])
      }
      reader.readAsText(file)
    }
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="flex-1 p-4 overflow-auto">
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Social Media Calendar</CardTitle>
                <CardDescription>Manage your personal and public events</CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button onClick={handleDownloadICS} variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Download Calendar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload').click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Dates
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Calendar
              localizer={localizer}
              events={filteredEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 500 }}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              selectable
              view={view}
              onView={onView}
              date={date}
              onNavigate={onNavigate}
              components={{
                event: (props: { event: Event; title: string }) => (
                  <div className="flex items-center">
                    {getEventTypeIcon(props.event.type)}
                    <span className="ml-1 text-sm">{props.title}</span>
                    {getCategoryIcon(props.event.category)}
                  </div>
                ),
              }}
              eventPropGetter={eventStyleGetter}
              views={['month', 'week', 'day', 'agenda']}
            />
          </CardContent>
        </Card>

        {selectedEvent && !selectedEvent.source && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>{selectedEvent.id ? 'Edit Event' : 'Add New Event'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="event-title">Title</Label>
                  <Input
                    id="event-title"
                    value={selectedEvent.title}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, title: e.target.value })}
                    placeholder="Enter event title"
                  />
                </div>
                <div className="flex space-x-4">
                  <div className="flex-1">
                    <Label htmlFor="event-start">Start Time</Label>
                    <Input
                      id="event-start"
                      type="datetime-local"
                      value={moment(selectedEvent.start).format('YYYY-MM-DDTHH:mm')}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, start: new Date(e.target.value) })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label htmlFor="event-end">End Time</Label>
                    <Input
                      id="event-end"
                      type="datetime-local"
                      value={moment(selectedEvent.end).format('YYYY-MM-DDTHH:mm')}
                      onChange={(e) => setSelectedEvent({ ...selectedEvent, end: new Date(e.target.value) })}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="event-type">Type</Label>
                  <Select onValueChange={(value) => setSelectedEvent({ ...selectedEvent, type: value as Event['type'] })}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedEvent.type} />
                    </SelectTrigger>
                    <SelectContent>
                      {['post', 'birthday', 'anniversary', 'eatout', 'meeting', 'worlddates', 'holiday', 'study', 'hobby', 'payment'].map((type) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center">
                            {getEventTypeIcon(type as Event['type'])}
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="event-category">Category</Label>
                  <Select onValueChange={(value) => setSelectedEvent({ ...selectedEvent, category: value as EventCategory })}>
                    <SelectTrigger>
                      <SelectValue placeholder={selectedEvent.category} />
                    </SelectTrigger>
                    <SelectContent>
                      {personalCalendars.map((calendar) => (
                        <SelectItem key={calendar.id} value={calendar.name.toLowerCase()}>
                          <div className="flex items-center">
                            <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: calendar.color }}></div>
                            {calendar.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="event-location">Location</Label>
                  <Input
                    id="event-location"
                    value={selectedEvent.location || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, location: e.target.value })}
                    placeholder="Enter event location"
                  />
                </div>
                <div>
                  <Label htmlFor="event-webLink">Web Link</Label>
                  <Input
                    id="event-webLink"
                    value={selectedEvent.webLink || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, webLink: e.target.value })}
                    placeholder="https://example.com"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={handleSaveEvent}>
                    {selectedEvent.id ? 'Update Event' : 'Add Event'}
                  </Button>
                  {selectedEvent.id && (
                    <Button variant="destructive" onClick={() => handleDeleteEvent(selectedEvent.id)}>
                      Delete
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setSelectedEvent(null)}>Cancel</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Personal Event Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {filteredEvents
                  .sort(sortEventsByDate)
                  .map(event => {
                    const isPrivateEvent = ['personal', 'work', 'family'].includes(event.category.toLowerCase());
                    const isPastEvent = event.end < new Date();
                    return (
                      <div 
                        key={event.id} 
                        className={`flex items-center justify-between py-2 px-3 mb-2 rounded-md transition-all hover:shadow-md ${
                          isPastEvent ? 'text-gray-400' : ''
                        }`}
                      >
                        <div className="flex-1 flex items-center space-x-2 overflow-hidden">
                          <div 
                            className={`w-3 h-3 flex-shrink-0 rounded-full ${
                              isPastEvent ? 'opacity-50' : ''
                            }`}
                            style={{ backgroundColor: event.source ? getSourceColor(event.source) : personalCalendars.find(cal => cal.name.toLowerCase() === event.category)?.color }}
                          ></div>
                          {getEventTypeIcon(event.type)}
                          <span className="font-medium truncate">{event.title}</span>
                          <span className="text-sm">
                            {moment(event.start).format('MMM D, HH:mm')}
                          </span>
                          {event.location && (
                            <span className="text-sm truncate">| {event.location}</span>
                          )}
                          {event.source && (
                            <span className="text-xs bg-white bg-opacity-20 px-1 rounded">
                              {event.source}
                            </span>
                          )}
                          {event.webLink && (
                            <a 
                              href={event.webLink} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className={`hover:underline ${isPastEvent ? 'text-gray-400' : 'text-blue-500'}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Link className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                        <div className="flex-shrink-0 ml-2 space-x-1">
                          {!event.source && !isPastEvent && (
                            <Button variant="ghost" size="icon" onClick={() => setSelectedEvent(event)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {!isPrivateEvent && !isPastEvent ? (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleShareEvent(event)}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Tooltip content={isPastEvent ? "Past events can't be shared" : "This event can't be shared"}>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                disabled
                              >
                                <Share2 className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteEvent(event.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Public Calendar Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {Object.values(filteredGroupedPublicEvents)
                  .flat()
                  .sort(sortEventsByDate)
                  .map(event => {
                    const isPastEvent = event.date < new Date();
                    return (
                      <div key={event.id} className={`flex items-center justify-between py-2 border-b last:border-b-0 ${
                        isPastEvent ? 'text-gray-400' : ''
                      }`}>
                        <div className="flex-1">
                          <div className="flex items-center">
                            {getEventTypeIcon(event.type)}
                            <span className="font-medium ml-2">{event.title}</span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span>{moment(event.date).format('MMM D, YYYY HH:mm')}</span>
                            {event.location && (
                              <span className="ml-2">| {event.location}</span>
                            )}
                          </div>
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <div 
                              className={`w-3 h-3 rounded-full mr-2 ${isPastEvent ? 'opacity-50' : ''}`}
                              style={{ backgroundColor: getSourceColor(event.source) }}
                            ></div>
                            {event.source}
                          </div>
                          {event.webLink && (
                            <a href={event.webLink} target="_blank" rel="noopener noreferrer" className={`hover:underline text-sm mt-1 inline-block ${isPastEvent ? 'text-gray-400' : 'text-blue-500'}`}>
                              Event Link
                            </a>
                          )}
                          <div className="text-xs text-gray-400 mt-1">
                            Added: {moment(event.dateAdded).fromNow()}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleLikeEvent(event.id)}
                            className={`p-1 rounded-full ${likedEvents.has(event.id) ? "bg-red-100" : ""}`}
                          >
                            <Heart 
                              className={`h-4 w-4 ${likedEvents.has(event.id) ? "text-red-500" : "text-gray-500"}`} 
                              fill={likedEvents.has(event.id) ? "currentColor" : "none"} 
                            />
                          </button>
                          {event.likeCount && <span className="text-xs text-gray-500">{event.likeCount}</span>}
                          <Button variant="ghost" size="icon" onClick={() => handleLinkPublicEvent(event)} disabled={isPastEvent}>
                            <Link className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="w-80 m-4 space-y-4 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>Analytics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Next Event:</span>
                <span>{getNextEvent()?.title || 'No upcoming events'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-green-500" />
                <span className="font-medium">Public Calendars Followed:</span>
                <span>{followedCalendars.filter(cal => cal.followed).length}</span>
              </div>
              <div className="flex items-center space-x-2">
                <BarChart2 className="h-5 w-5 text-purple-500" />
                <span className="font-medium">Total Events:</span>
                <span>{filteredEvents.length}</span>
              </div>
              <div className="space-y-2">
                {Object.entries(countEventsByCategory()).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(category as EventCategory)}
                      <span>{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                <span className="font-medium">Most Active Category:</span>
                <span>{getMostActiveCategory()}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-blue-500" />
                <span className="font-medium">Busiest Day:</span>
                <span>{getBusiestDay()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Followed Public Calendars</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {followedCalendars.map(calendar => (
                <div key={calendar.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-2" 
                      style={{ backgroundColor: getSourceColor(calendar.name) }}
                    ></div>
                    {calendar.name}
                  </div>
                  <Button
                    variant={calendar.followed ? "default" : "outline"}
                    onClick={() => handleToggleFollowCalendar(calendar.id)}
                  >
                    {calendar.followed ? 'Unfollow' : 'Follow'}
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="w-full">
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filterType} onValueChange={(value) => setFilterType(value as Event['type'] | 'all')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {['post', 'birthday', 'anniversary', 'eatout', 'meeting', 'worlddates', 'holiday', 'study', 'hobby', 'payment'].map((type) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center">
                        {getEventTypeIcon(type as Event['type'])}
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={(value) => setFilterCategory(value as EventCategory | 'all')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {personalCalendars.map((calendar) => (
                    <SelectItem key={calendar.id} value={calendar.name.toLowerCase()}>
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: calendar.color }}></div>
                        {calendar.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPublicCalendar} onValueChange={(value) => setFilterPublicCalendar(value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by public calendar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Calendars</SelectItem>
                  <SelectItem value="personal">Personal Events</SelectItem>
                  {followedCalendars
                    .filter(calendar => calendar.followed)
                    .map((calendar) => (
                      <SelectItem key={calendar.id} value={calendar.name}>
                        {calendar.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Personal Calendars
              <Button variant="outline" size="sm" onClick={handleAddPersonalCalendar}>
                <Plus className="h-4 w-4 mr-2" />
                Add Calendar
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              {personalCalendars.map(calendar => (
                <div key={calendar.id} className="flex items-center justify-between py-2">
                  {editingCalendar && editingCalendar.id === calendar.id ? (
                    <>
                      <Input
                        value={editingCalendar.name}
                        onChange={(e) => setEditingCalendar({...editingCalendar, name: e.target.value})}
                        className="w-1/2 mr-2"
                      />
                      <Input
                        type="color"
                        value={editingCalendar.color}
                        onChange={(e) => setEditingCalendar({...editingCalendar, color: e.target.value})}
                        className="w-12 h-8 p-0 mr-2"
                      />
                      <Button variant="ghost" size="icon" onClick={handleUpdatePersonalCalendar}>
                        <Check className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center">
                        <div 
                          className="w-4 h-4 rounded-full mr-2" 
                          style={{ backgroundColor: calendar.color }}
                        ></div>
                        {calendar.name}
                      </div>
                      <div>
                        {calendar.name.toLowerCase() !== 'personal' && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleShareCalendar(calendar.id)}
                            title="Share Calendar"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditPersonalCalendar(calendar)}
                          title="Edit Calendar"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeletePersonalCalendar(calendar.id)}
                          title="Delete Calendar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}