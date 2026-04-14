import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { useVisitor } from '../../context/VisitorContext';
import { getRelevantTestimonials, type Testimonial } from '../../config/landingVariants';
import { useTranslation } from 'react-i18next';

// Country flag emojis
const COUNTRY_FLAGS: Record<string, string> = {
    'FR': '🇫🇷',
    'SN': '🇸🇳',
    'CI': '🇨🇮',
    'CM': '🇨🇲',
    'ML': '🇲🇱',
    'BF': '🇧🇫',
    'CA': '🇨🇦',
    'US': '🇺🇸',
    'GB': '🇬🇧',
    'DE': '🇩🇪',
    'ES': '🇪🇸'
};

interface TestimonialCardProps {
    testimonial: Testimonial;
    index: number;
}

function TestimonialCard({ testimonial, index }: TestimonialCardProps) {
    const flag = COUNTRY_FLAGS[testimonial.countryCode] || '🌍';

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            viewport={{ once: true }}
            style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '1.25rem',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
        >
            {/* Quote icon */}
            <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                opacity: 0.1
            }}>
                <Quote size={48} color="#e2e8f0" />
            </div>

            {/* Stars */}
            <div style={{ display: 'flex', gap: '0.25rem' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                        key={i}
                        size={16}
                        fill={i < testimonial.rating ? '#fbbf24' : 'transparent'}
                        color={i < testimonial.rating ? '#fbbf24' : '#475569'}
                    />
                ))}
            </div>

            {/* Quote */}
            <p style={{
                color: '#475569',
                fontSize: '1rem',
                lineHeight: 1.7,
                fontStyle: 'italic',
                flex: 1
            }}>
                "{testimonial.quote}"
            </p>

            {/* Author */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '1.5rem'
            }}>
                {/* Avatar */}
                <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: 'white'
                }}>
                    {testimonial.name.charAt(0)}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                    <div style={{
                        color: '#0f172a',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        {testimonial.name}
                        <span style={{ fontSize: '1rem' }}>{flag}</span>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {testimonial.role} • {testimonial.company}
                    </div>
                </div>

                {/* Sector badge */}
                {testimonial.sector && (
                    <div style={{
                        padding: '0.25rem 0.75rem',
                        background: '#eff6ff',
                        borderRadius: '1rem',
                        fontSize: '0.75rem',
                        color: '#2563eb',
                        textTransform: 'uppercase',
                        fontWeight: 600
                    }}>
                        {testimonial.sector}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default function Testimonials() {
    const { t } = useTranslation();
    const { countryCode, trafficSource } = useVisitor();

    // Get sector from traffic source if available
    const sectorFromSource = trafficSource?.includes('btp') ? 'btp'
        : trafficSource?.includes('cleaning') ? 'cleaning'
            : trafficSource?.includes('security') ? 'security'
                : undefined;

    // Get relevant testimonials based on visitor context
    const relevantTestimonials = getRelevantTestimonials(countryCode, sectorFromSource, 3);

    return (
        <section id="testimonials" style={{
            padding: '6rem 5%',
            background: '#f8fafc'
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center', marginBottom: '4rem' }}
                >
                    <h2 style={{
                        color: '#0f172a',
                        fontSize: '2.5rem',
                        fontWeight: 800,
                        marginBottom: '1rem',
                        letterSpacing: '-0.02em'
                    }}>
                        {t('landing.testimonials.title', 'Ils nous font confiance')}
                    </h2>
                    <p style={{
                        color: '#64748b',
                        fontSize: '1.1rem',
                        maxWidth: '600px',
                        margin: '0 auto'
                    }}>
                        {t('landing.testimonials.subtitle', 'Découvrez ce que nos clients disent de WhatsPoint')}
                    </p>
                </motion.div>

                {/* Testimonial Cards */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: '2rem'
                }}>
                    {relevantTestimonials.map((testimonial, index) => (
                        <TestimonialCard
                            key={testimonial.id}
                            testimonial={testimonial}
                            index={index}
                        />
                    ))}
                </div>

                {/* Trust indicators */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.3 }}
                    viewport={{ once: true }}
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '3rem',
                        marginTop: '4rem',
                        flexWrap: 'wrap'
                    }}
                >
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#3b82f6', fontSize: '2.5rem', fontWeight: 800 }}>500+</div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                            {t('landing.testimonials.companies', 'Entreprises')}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#10b981', fontSize: '2.5rem', fontWeight: 800 }}>15K+</div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                            {t('landing.testimonials.employees', 'Employés gérés')}
                        </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#f59e0b', fontSize: '2.5rem', fontWeight: 800 }}>4.8★</div>
                        <div style={{ color: '#64748b', fontSize: '0.9rem' }}>
                            {t('landing.testimonials.rating', 'Note moyenne')}
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
